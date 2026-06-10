console.log("Testing authorization header...");

const testAuth = async (headerVal) => {
  try {
    const res = await fetch("http://4.224.186.213/evaluation-service/notifications", {
      headers: {
        "Authorization": headerVal
      }
    });
    const body = await res.text();
    console.log(`Header: "${headerVal}" -> Status: ${res.status}`);
    console.log(`Body: ${body.slice(0, 500)}`);
  } catch (err) {
    console.error("Error:", err);
  }
};

const run = async () => {
  await testAuth("Bearer abc");
  await testAuth("abc");
  await testAuth("Basic abc");
  await testAuth("Bearer ");
};
run();
