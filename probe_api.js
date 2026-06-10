const endpoints = [
  { url: "http://4.224.186.213/", method: "GET" },
  { url: "http://4.224.186.213/evaluation-service", method: "GET" },
  { url: "http://4.224.186.213/evaluation-service/auth", method: "POST" },
  { url: "http://4.224.186.213/evaluation-service/login", method: "POST" },
  { url: "http://4.224.186.213/evaluation-service/register", method: "POST" },
  { url: "http://4.224.186.213/evaluation-service/token", method: "POST" },
  { url: "http://4.224.186.213/evaluation-service/notifications", method: "GET" },
];

const probe = async () => {
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: { "Content-Type": "application/json" }
      });
      const text = await res.text();
      console.log(`${ep.method} ${ep.url} -> Status: ${res.status}`);
      console.log(`Response: ${text.slice(0, 300)}`);
    } catch (err) {
      console.log(`${ep.method} ${ep.url} -> Error: ${err.message}`);
    }
  }
};
probe();
