const rateLimit = require('express-rate-limit');

const postLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Too Many Requests</title>
		    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
			<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600&display=swap" rel="stylesheet">
          <style>
            body {	
              margin: 0;
              padding: 0;
              background: linear-gradient(135deg, #4facfe, #8e44ad);
              color: white;
              font-family: 'Montserrat', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              text-align: center;
              flex-direction: column;
            }
            h1 {
              font-size: 2.5em;
              margin-bottom: 0.5em;
              text-shadow: 1px 1px 4px rgba(0, 0, 0, 0.3);
            }
            p {
              font-size: 1.2em;
              margin-bottom: 1.5em;
            }
            a.button {
              background-color: white;
              color: #4facfe;
              padding: 0.7em 1.4em;
              border-radius: 8px;
              text-decoration: none;
              font-weight: bold;
              box-shadow: 0 4px 10px rgba(0,0,0,0.2);
              transition: background 0.3s, color 0.3s;
              pointer-events: none;
              opacity: 0.5;
            }
            a.button.enabled {
              pointer-events: auto;
              opacity: 1;
            }
          </style>
        </head>
        <body>
          <h1>Whoa there!</h1>
          <p>You're clicking a little too fast. Please wait <span id="countdown">15</span> seconds.</p>
          <a class="button" id="backButton" href="/dashboard">Back to Dashboard</a>

          <script>
            let seconds = 15;
            const countdownEl = document.getElementById('countdown');
            const button = document.getElementById('backButton');

            const timer = setInterval(() => {
              seconds--;
              countdownEl.textContent = seconds;
              if (seconds <= 0) {
                clearInterval(timer);
                button.classList.add('enabled');
              }
            }, 1000);
          </script>
        </body>
      </html>
    `);
  }
});

module.exports = postLimiter;


