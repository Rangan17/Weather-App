const express = require('express');
const fs = require('fs');
const requests = require('requests');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const app = express();
const port = 8000;


app.use(express.static(__dirname + '/public')); // Serve static files from the 'public' directory
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'your-secret-key', // Change this to a strong secret
    resave: false,
    saveUninitialized: false,
  })
);

const homeFile = fs.readFileSync('weather.html', 'utf-8');

const replaceVal = (tempVal, orgVal) => {
  let temperature = tempVal.replace('{%tempval%}', orgVal.main.temp);
  temperature = temperature.replace('{%tempmin%}', orgVal.main.temp_min);
  temperature = temperature.replace('{%tempmax%}', orgVal.main.temp_max);
  temperature = temperature.replace('{%location%}', orgVal.name);
  temperature = temperature.replace('{%country%}', orgVal.sys.country);
  temperature = temperature.replace('{%tempstatus%}', orgVal.weather[0].main);
  return temperature;
};

const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: 'ritankar123',
  database: 'user',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database: ' + err);
    return;
  }
  console.log('Connected to the database');
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/home.html');
});
app.get('/home', (req, res) => {
  res.sendFile(__dirname + '/home.html');
});

app.get('/weather', (req, res) => {
  requests('https://api.openweathermap.org/data/2.5/weather?q=kolkata&appid=ac1f585e2c3df64817bdd14d82b9e8ac&units=metric')
    .on('data', (chunk) => {
      const objdata = JSON.parse(chunk);
      const arrData = [objdata];
      const realTimeData = arrData.map((val) => replaceVal(homeFile, val)).join('');
      res.send(realTimeData);
    })
    .on('end', (err) => {
      if (err) {
        console.error('Connection closed due to errors', err);
        res.status(500).send('Internal Server Error');
      }
    });
});

app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/registration.html');
});

// Handle user registration
app.post('/register', [
  body('name').isString(),
  body('email').isEmail(),
  body('password').isString(),
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { name, email, password } = req.body;

  

  // Hash the password before storing it in the database
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = { name, email, password: hashedPassword };

  db.query('INSERT INTO users SET ?', user, (err, result) => {
    if (err) {
      console.error('Error registering user: ' + err);
      res.status(500).json({ error: 'Database Error', details: err.message });
    } else {
      res.redirect('/login'); // Redirect to the login page
    }
  });
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});
// Handle login form submission
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email = ?', email, async (err, results) => {
    if (err) {
      console.error('Error querying the database: ' + err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }

    if (results.length === 1) {
      // Compare the hashed password
      const user = results[0];
      const passwordMatch = await bcrypt.compare(password, user.password);

      if (passwordMatch) {
        // Authentication successful
        req.session.loggedIn = true;
        req.session.user = user;
        res.redirect('/weather'); // Redirect to the weather page
      } else {
        res.status(401).json({ error: 'Login failed' });
      }
    } else {
      res.status(401).json({ error: 'Login failed' });
    }
  });
});

// Protect routes that require authentication
function requireAuth(req, res, next) {
  if (req.session.loggedIn) {
    return next();
  } else {
    res.redirect('/login');
  }
}

app.get('/weather', requireAuth, (req, res) => {
  requests('https://api.openweathermap.org/data/2.5/weather?q=kolkata&appid=ac1f585e2c3df64817bdd14d82b9e8ac&units=metric')
    .on('data', (chunk) => {
      const objdata = JSON.parse(chunk);
      const arrData = [objdata];
      const realTimeData = arrData.map((val) => replaceVal(homeFile, val)).join('');
      res.send(realTimeData);
    })
    .on('end', (err) => {
      if (err) {
        console.error('Connection closed due to errors', err);
        res.status(500).send('Internal Server Error');
      }
    });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
