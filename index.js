const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("cat2 Server is live"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`cat2 Server running on port ${PORT}`));
