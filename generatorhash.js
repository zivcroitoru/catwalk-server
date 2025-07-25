const bcrypt = require('bcrypt');

async function generateHash() {
  const password = '123456';  // <-- Change this to your desired password
  const saltRounds = 10;

  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Hashed password:', hash);
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

generateHash();
