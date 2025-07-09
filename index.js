const express = require('express');
const cors = require('cors');
require("dotenv").config();
const DB = require('./db');

const app = express();
const PORT = 3000;

const authRoutes = require('./routes/auth');

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);

app.get('/api/test', (req, res) => {
  DB.query("select * from users")
  .then((response) => {console.log(response.rows)});
  res.json({ message: 'Hello from server' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get('/api/wow', (req,res) =>{
  query = 'select * from users';
  DB.query(query)
  .then((response) => {
    if (response.rows.length === 0){
      res.status(200).send("Not found");
    }
    res.status(200).send(response.rows);
  })
  .catch((error) => {
    console.log(error);
    res.status(404).send("ERROR");
  })
})