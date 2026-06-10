const register = async () => {
  const bodyData = {
    companyName: "Affordmed",
    ownerName: "Jatin Pratap Singh",
    ownerEmail: "jatinpratapsingh0079@gmail.com", // based on the github account name jadaun0079
    rollNo: "2201920100062" // Let's guess or try some roll number or standard one
  };
  
  console.log("Registering with:", bodyData);
  try {
    const res = await fetch("http://4.224.186.213/evaluation-service/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData)
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
  } catch (err) {
    console.error("Error:", err);
  }
};
register();
