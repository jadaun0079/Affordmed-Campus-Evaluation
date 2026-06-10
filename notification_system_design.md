# Stage 1

## Core Actions of the Notification Platform
1. **Register Candidate**: Enables candidates to register their credentials (name, email, mobileNo, githubUsername, accessCode) and retrieve authorization keys (`clientID` and `clientSecret`).
2. **Authenticate Candidate**: Obtains a secure `Bearer` authorization token using registration keys, required for all protected notification routes.
3. **Fetch Notifications**: Retrieves notifications (all or unread) for a logged-in user, supporting pagination (`page`, `limit`) and filtering by notification type.
4. **Mark Notification as Read / Viewed**: Updates the state of a specific notification to prevent it from cluttering the unread views.
5. **Real-Time Delivery**: Pushes notification events to active client sessions immediately upon creation.

## REST API Endpoints Contract

### 1. Register Candidate
- **Endpoint**: `POST /evaluation-service/register`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body JSON Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "email": { "type": "string", "format": "email" },
      "mobileNo": { "type": "string" },
      "githubUsername": { "type": "string" },
      "accessCode": { "type": "string" }
    },
    "required": ["name", "email", "mobileNo", "githubUsername", "accessCode"]
  }
  ```
- **Response Structure (Status 200)**:
  ```json
  {
    "clientID": "a4d3f56b-87b6-4f44-90a4-3990b14576bc",
    "clientSecret": "sec_b283218f_ea5a_4b7c_93a9_1f2f240d64b0",
    "message": "Candidate registered successfully"
  }
  ```

### 2. Authenticate Candidate
- **Endpoint**: `POST /evaluation-service/auth`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body JSON Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "email": { "type": "string" },
      "name": { "type": "string" },
      "rollNo": { "type": "string" },
      "accessCode": { "type": "string" },
      "clientID": { "type": "string" },
      "clientSecret": { "type": "string" }
    },
    "required": ["email", "name", "rollNo", "accessCode", "clientID", "clientSecret"]
  }
  ```
- **Response Structure (Status 200)**:
  ```json
  {
    "authorization_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
  ```

### 3. Fetch Notifications (Protected Route)
- **Endpoint**: `GET /evaluation-service/notifications`
- **Headers**:
  - `Authorization: Bearer <authorization_token>`
- **Query Parameters**:
  - `limit` (optional, default: 10): Number of notifications per page.
  - `page` (optional, default: 1): Page index.
  - `notification_type` (optional): Filter by type (`Event`, `Result`, or `Placement`).
- **Response Structure (Status 200)**:
  ```json
  {
    "notifications": [
      {
        "ID": "d146095a-0d86-4a34-9e69-3900a14576bc",
        "Type": "Result",
        "Message": "mid-sem",
        "Timestamp": "2026-04-22 17:51:30"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 48
    }
  }
  ```

## Real-Time Notification Mechanism
To deliver notifications in real-time to active users, we choose **Server-Sent Events (SSE)**.
- **Why SSE over WebSockets?**
  1. **Unidirectional flow**: Notifications are sent strictly from server to client. WebSockets are designed for full-duplex communication (e.g. chat applications), which is unnecessary overhead.
  2. **Reconnection out-of-the-box**: SSE automatically handles link drops and client reconnections with built-in retry mechanisms over standard HTTP/1.1 or HTTP/2.
  3. **Lighter & Easy to Scale**: SSE operates over standard HTTP, making it easier to integrate with firewalls, load balancers, and reverse proxies (like Nginx) without special configuration.

---

# Stage 2

## Persistent Database Selection
We suggest **PostgreSQL** (a relational database) as the primary storage engine.
- **Data Integrity & Consistency**: Notifications involve critical student updates (placements, exam results). Relational DBs guarantee ACID compliance.
- **Structured Schema**: The notification data model is highly structured and does not require a schemaless Document DB.
- **Rich Indexing Options**: Supports advanced index strategies (partial indexes, composite indexes, partition pruning), which are crucial for low-latency queries at scale.

## Database Schema (DDL)
```sql
-- Create Students Table
CREATE TABLE students (
    student_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    roll_no VARCHAR(50) UNIQUE NOT NULL,
    mobile_no VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Notification Types Enum
CREATE TYPE n_type AS ENUM ('Event', 'Result', 'Placement');

-- Create Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(50) REFERENCES students(student_id) ON DELETE CASCADE,
    notification_type n_type NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    read_at TIMESTAMP
);

-- Create Composite Index for student feeds (Stage 3 optimization)
CREATE INDEX idx_notifications_student_unread 
ON notifications (student_id, is_read, created_at DESC);
```

## Potential Problems at Scale & Solutions
As volumes increase (e.g. 50,000 students and 5,000,000 notifications):
1. **Index Size Exceeding RAM**: Sequential scans occur if index records are forced to disk.
   * *Solution*: **Table Partitioning**. Partition the `notifications` table by month/quarter range of `created_at` or by hashing `student_id`.
2. **Table Bloat & I/O Saturation**: Rapid updates to `is_read` trigger heavy disk writing.
   * *Solution*: **Redis Caching**. Store the unread count and the top 20 recent notifications in a Redis Cache. Read queries pull directly from Redis; updates write to Redis and enqueue a background write to PostgreSQL.
3. **Database Connection Exhaustion**: Page loads from 50,000 active students saturate connections.
   * *Solution*: **Read Replicas** and **Connection Pooling** (using PgBouncer).

## SQL Queries

### 1. Insert New Notification
```sql
INSERT INTO notifications (student_id, notification_type, message)
VALUES ('1042', 'Result', 'mid-sem');
```

### 2. Fetch Unread Notifications for a Student (Sorted by Recency)
```sql
SELECT id, notification_type, message, created_at
FROM notifications
WHERE student_id = '1042' AND is_read = FALSE
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
```

### 3. Mark Single Notification as Read
```sql
UPDATE notifications
SET is_read = TRUE, read_at = NOW()
WHERE id = 'd146095a-0d86-4a34-9e69-3900a14576bc' AND student_id = '1042';
```

### 4. Mark All as Read for a Student
```sql
UPDATE notifications
SET is_read = TRUE, read_at = NOW()
WHERE student_id = '1042' AND is_read = FALSE;
```

---

# Stage 3

## Query Analysis
```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

### 1. Is this query accurate?
- Yes, syntactically. However, ordering by `createdAt ASC` displays the oldest unread notifications first. Users expect to see the most recent notifications first (`ORDER BY createdAt DESC`).
- Selecting all columns (`SELECT *`) should be replaced by selecting specific columns (e.g., `id`, `type`, `message`, `createdAt`) to optimize payload size.

### 2. Why is this query slow?
- With 5,000,000 notifications, if no indexes are set, the database performs a **Sequential Scan** (reads the entire table from disk) to filter rows.
- If individual indexes on `studentID` or `isRead` exist, PostgreSQL performs an index scan but must still perform filter filtering and sort operations in-memory (costing heavy CPU and disk I/O).

### 3. What would you change?
- Create a composite index specifically covering the filter and sorting fields:
  ```sql
  CREATE INDEX idx_notifications_student_unread_lookup
  ON notifications (studentID, isRead, createdAt DESC);
  ```

### 4. What is the likely computation cost?
- **Without index**: O(N) where N = 5,000,000, with high disk read cost.
- **With composite index**: O(log N) search cost to locate the rows, with near-zero sorting cost because the index stores data pre-sorted by `createdAt DESC`.

### 5. Assessment: "Add indexes on every column to be safe"
- **This advice is NOT effective**.
  - **Write Penalty**: Every insert, update, and delete triggers writes to all indexes, degrading write latency.
  - **Storage Bloat**: Index sizes can exceed the table size, starving server RAM.
  - **Useless for Composite Queries**: Multi-column filters like `studentID = X AND isRead = Y` cannot utilize two single-column indexes effectively compared to one composite index.

## Query: Placement Notifications in the Last 7 Days
To find all students who received a `Placement` notification in the last 7 days:
```sql
SELECT DISTINCT student_id
FROM notifications
WHERE notification_type = 'Placement'
  AND created_at >= NOW() - INTERVAL '7 days';
```

---

# Stage 4

## Mitigations for Database Overwhelm on Page Load

### 1. Client-Side Polling vs Server-Side Pushes (SSE/WebSockets)
- *Tradeoff*: SSE keeps database read queries to zero during active sessions since notifications are pushed immediately upon creation. However, maintaining thousands of persistent TCP connections uses server memory.

### 2. Redis Caching (Unread Counts & Feed Cache)
- *Tradeoff*: Read queries hit Redis (fetching in <1ms) instead of hitting SQL. Cache must be invalidated / updated when a new notification is created or marked read.

### 3. Read Replicas (Load Balancing)
- *Tradeoff*: Directs read traffic away from the primary database. Introduced replication lag means a student might not see a notification immediately after creation.

### 4. Lazy Loading / Pagination
- *Tradeoff*: Load only the top 5-10 notifications on page load. Load additional notifications only if the user opens the notification drawer. Reduces initial payload size but increases request count.

---

# Stage 5

## Shortcomings of Synchronous Execution
```python
save_to_db(student_id, message)
push_to_app(student_id, message)
```
1. **Blocking Network I/O**: Network failures during `push_to_app` or third-party mailing (e.g. SMTP/SES timeout) block the database connection, leading to pool exhaustion.
2. **Transaction Integrity Failure**: If `save_to_db` succeeds but the email fails mid-way, the transaction rolls back (losing database record) or goes out-of-sync (email failed but database says sent).
3. **No Retries**: Failed notifications are permanently lost without retry queues.

## Redesigned Asynchronous Architecture
We decouple database storage and notification sending using an **Asynchronous Message Queue** (like RabbitMQ, Kafka, or BullMQ/Redis):

```
[API POST request] 
       │
       ▼
1. Save notification to DB (fast)
2. Publish message to Message Queue (e.g., 'notification-task-queue')
3. Return 202 Accepted response to client (UX remains fast)
       │
       ▼
[Message Queue Broker]
       │
       ▼
[Background Worker Consumer]
       │
       ├──► Attempt real-time Push (SSE)
       └──► Attempt Email delivery (Third-party SMTP/SES)
             │
             ├──► [Success] ──► Acknowledge message queue
             └──► [Failure] ──► Retry with Exponential Backoff (Max 5 retries) 
                                 └──► [Dead Letter Queue (DLQ)] (Manual investigation)
```

## Revised Pseudocode
```python
# API Endpoint Handler (Producer)
def handle_create_notification(student_id, message_body, notification_type):
    # 1. Persist to DB (Critical & Fast)
    notification = db.save_notification(student_id, message_body, notification_type)
    
    # 2. Enqueue event task payload (Decoupled & Fast)
    queue_payload = {
        "notification_id": notification.id,
        "student_id": student_id,
        "message": message_body,
        "type": notification_type,
        "retry_count": 0
    }
    message_queue.publish("notification-task-queue", queue_payload)
    
    # 3. Respond immediately
    return HTTP_Status.ACCEPTED  # 202

# Background Worker Process (Consumer)
def worker_process_message():
    while True:
        task = message_queue.pop("notification-task-queue")
        if not task:
            continue
            
        success = False
        try:
            # Send Real-time Push & Email
            success = send_email_and_push(task["student_id"], task["message"])
        except Exception as e:
            log_error(f"Failed sending notification: {e}")
            
        if success:
            message_queue.acknowledge(task)
        else:
            if task["retry_count"] < 5:
                task["retry_count"] += 1
                # Enqueue with exponential backoff (e.g., 2^retry_count * 5 seconds)
                backoff_time = (2 ** task["retry_count"]) * 5
                message_queue.publish_delayed("notification-task-queue", task, delay=backoff_time)
                message_queue.acknowledge(task) # Remove original to prevent duplicates
            else:
                # Move to Dead Letter Queue for admin review
                message_queue.move_to_dlq(task)
                message_queue.acknowledge(task)
```

---

# Stage 6

## Priority Sorting Logic (Combination of Weight and Recency)
Priority scores are determined using:
1. **Notification Type Weights**:
   - `Placement` = 3 (Highest)
   - `Result` = 2 (Medium)
   - `Event` = 1 (Lowest)
2. **Recency**:
   - Represented as a Epoch Timestamp (milliseconds).
3. **Lexicographical / Hierarchical Sort**:
   - Sort descending by **Weight** first.
   - If weights match, sort descending by **Timestamp** (recency).

In code, this is calculated as:
```javascript
const sortedNotifications = notifications.sort((a, b) => {
  const weightMap = { "Placement": 3, "Result": 2, "Event": 1 };
  const weightA = weightMap[a.Type] || 0;
  const weightB = weightMap[b.Type] || 0;

  if (weightB !== weightA) {
    return weightB - weightA; // Higher weight first
  }
  return new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime(); // Most recent first
});
```

## Efficiently Maintaining the Top 10 Notifications
To maintain the top 10 notifications dynamically in memory when thousands of messages arrive continuously:
- **Min-Heap (Priority Queue) of Size 10**:
  - Instead of sorting the entire array of notifications (which is O(N log N) time complexity), we feed incoming notifications into a Min-Heap capped at a size of 10.
  - The heap is ordered by our priority scoring comparator (weight first, then recency). The root of the Min-Heap always represents the *lowest priority notification currently in the top 10*.
  - **Insertion logic**:
    1. If heap size < 10: Insert notification (cost O(log 10) = O(1)).
    2. If heap size = 10: Compare the incoming notification with the root element (lowest priority in top 10).
       - If incoming notification has a *higher* priority than the root: pop the root, and insert the new notification.
       - Else: discard the incoming notification (it doesn't make the top 10).
  - **Complexity**: Processing N stream notifications takes **O(N log 10)**, which simplifies to **O(N)**. This is extremely efficient compared to sorting the entire array which takes O(N log N).
