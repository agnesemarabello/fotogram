const express = require('express');
const bcrypt = require('bcrypt'); 
const crypto = require('crypto'); //cripta le password
const jwt = require('jsonwebtoken'); //utilizzato per autenticazione e autorizzazione nelle API (token JWT)
const router = express.Router(); //oggeto per definire gli endpoint delle API
const pool = require('./db'); //importa le connessioni verso il database che sono state definite in db.js

// Configurazione del database
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Errore di connessione al DB:', err);
  } else {
    console.log('Connessione al DB ok:', res.rows[0]);
  }
})

// ======================
// AUTENTICAZIONE
// ======================
// Un middleware in Express è una funzione che ha accesso all'oggetto richiesta (req), all'oggetto risposta (res) e alla funzione next() nel ciclo di richiesta-risposta dell'applicazione. 
// Può eseguire codice, modificare la richiesta o la risposta, terminare il ciclo di richiesta o passare il controllo al middleware successivo usando next().
// Viene spesso usato per autenticazione, logging, parsing di dati, gestione degli errori, ecc.

/*
 * Per capire dove si trova un dato nella richiesta:
 * - req.headers contiene gli header HTTP (es: Authorization, Content-Type, ecc.)
 * - req.body contiene i dati inviati dal client nel corpo della richiesta (POST/PUT), tipicamente in formato JSON o form.
 * - req.query contiene i parametri della query string (es: /api?foo=bar)
 * - req.params contiene i parametri dinamici dell'URL (es: /user/:id)
 * 
 * Esempio:
 *   - Un token di autenticazione si trova di solito in req.headers.authorization
 *   - I dati di login (username, password) sono spesso in req.body
 */

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    console.log('Authorization header:', authHeader);
    // authHeader è nel formato "Bearer <token>"
    // quindi faccio lo split dello spazio e prendo il secondo elemento)
    const token = authHeader?.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Token mancante' });
    }

    try {
        //verifico che il token sia valido utilizzando la chiave segreta
        // jwt.verify decodifica il token e verifica la firma
        const payload = jwt.verify(token, jwt_secret); //contiene i dati inderiti al momento della registrazine, quindi quando viene creato il token
        const session = await pool.query(
            'SELECT username FROM SESSIONE WHERE access_token = $1 AND timestamp_fine IS NULL',
            [token]
        );
        // se dalla query sono state restituite 0 righe, allora c'è un errore
        if (session.rowCount === 0) {
            return res.status(401).send({ message: 'Sessione non valida' });
        }

        req.user = {
            username: payload.username,
            access_token: token
        };

        next(); //fa continuare il flusso della richiesta
    } catch (err) {
        if (err.name === 'TokenExpiredError') { //nome dell'errore
            return res.status(401).send({ message: 'Access token scaduto, usa il refresh token' });
        }
        console.error('Errore autenticazione:', err);
        return res.status(401).send({ message: 'Token non valido o scaduto' });
    }
}

function base64ToBufferWithSizeCheck(base64String) {
    const maxSize = 100 * 1024; // 100 KB
    if (!base64String || typeof base64String !== 'string') {
        throw new Error('Immagine (base64) mancante o non valida');
    }
  
    if (base64String.startsWith('data:')) {
        base64String = base64String.split(',')[1];
    }
    let buffer;
    try {
        buffer = Buffer.from(base64String, 'base64');
    } catch {
        throw new Error('Immagine base64 non valida');
    }
    if (buffer.length > maxSize) {
        throw new Error(`Immagine troppo grande: ${buffer.length} byte, massimo ${maxSize} byte`);
    }
    return buffer;
}
//REGISTRAZIONE
router.post('/register', async (req, res) => {
    // #swagger.tags = ['Auth']
    // #swagger.summary = 'Registrazione nuovo utente'
    const { username, email, password } = req.body;
    if (!username || !email || !password)
        return res.status(400).send({ message: 'Dati mancanti' });


    
    const defaultImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAEhUlEQVR4nNVZz28bRRTeC1ScOQAqEkJCgKB/BRJXRIUEKicOjp3gpMhxkzYOJRC1SdPEnjFw4V+AEwevf8RO4jaxPdOkcOBE4B+gohL+sfPGRR701k7qxHbwzo4dGOmTVt6dt9/beTPve8+WZWB8y+ovUiY/plwmCZdZyuQh4fCYMGi64PC4/ZvMus9U5BWcY53n+Iap5wmDq5TDA8ql0gFhwJNMzKCtsRFPVhovEyYpYdDQJd4DBnXKJImXGhdHRvy7ffUM5fAZYVAzRpz3rEiDMPll8ld1wSh5wuENwuHnURGnPYCfNhi8boQ85fDBKL86HexElTK47O/LM/kJ5fBk/ORlO6Q4/E1Zc1KP/INm6LyI01PAk8p72KD3/wHytLMSpALvD0U+fiBeIxz+Om/S9LQTDGpf78ObZ5Jf+kU9a+q0STCp1kpSrZXb14aceIjH+eDQYXDDzws2KqBi20KFM0IFUs4JTGeFiu0IFa+ALyeSHK71D51S46KbETUN3yyCCtonSfdDyHbUF0XhK5QS+/WXehxAeaBlkEs1vwX/Svw05gvgztV0JN5PmGlpm9i2d/JHWNzRDCcG9RMCsK0qvRu6UwYVGCJsBsJ21J2SnhMJLsJPN6+mJI5s9m5Wr5jNa+4HBswljxuCMGh5NRBn+qHTjYmU49rS2MwtWq69YHUqKc8Glu+bcSCQctTyrl4YES4/srDE05n8+Y45B24WdTezJFanTvU8OWbQgZj2aSRtDKHfdSZjMjLlwNI93Y0sD/EE+lNn8sqeuRVY2dPOB49Q/0jNDaRCaf+rELId7YxMGIC2A4iFEnEk1mdYnP5l2/EltDCHC5G/aBrhUqyVQExpyIphy1Kpu7B87IA+1j9Fu3NqTKmQPH06TaeHOoT7f2z5GNRPZaaxXpIrmhSsNBhHHe/jMetkAeX6UyCryihFjHdwtS7VYBDW7KdRMrg28xsyN90y+K8nkhxYKIh0xd94gR2KuUw/w/50DHMrH9QA2js6bEPWM5qcnSko/Bf0gYAfCbxeCDlNStlsqkmgTZaC+ug9ucX81J/pKDDxm8R4+g8/6cYxwueG7rYL65daudEtC3Uw8mxfq9m7b1vAOQHXg31OEwfVhjKyU2l/alBqdyQp1e9iszCBqDRrYtsP23aDJqFvmCuZkdOAUMLzO1EYMDs5sLZ7V3MUkFM6MhnigC/iOfgkPO3L4T9GZ5J9uaLjc3V5H0WVC+3vRSqtdIeW21zm8Z3kZSd4M4uS18njJB45PLcdVuphxE0wGLJ1xl8mJKR963y+m0o5arzSnLT/jxhYshWynNW7ywVSjNbclli0TYyEv3g1nnPq4yIczjfr1onjHMjlmbHUhmnd+DNmNka1GMOW05vKQjZTUc9aoxsJ27VIkJw6CBh0J2Y1WZFPsL92rvmWNaywWxavXCuKH6axT1Wqx2+6ZX40WnO+jBfXK2Ij3G9Fs7dJcQZBIznk4kxWPpjKOxBXCEhKB11PphpzOiT9mN8XB/JaTmE/X3jbx8n8A0x2IRmBkF3AAAAAASUVORK5CYII=';
    let imgBuffer = Buffer.from(defaultImageBase64, 'base64');

    try {
        const exists = await pool.query(
            'SELECT 1 FROM UTENTE WHERE username = $1 OR email = $2',
            [username, email]
        );
        if (exists.rowCount > 0)
            return res.status(409).send({ message: 'Username o email già esistenti' });

        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            `INSERT INTO UTENTE (username, email, password, timestamp_user, immagine_profilo, ruolo, limitato)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'utente', FALSE)`,
            [username, email, hash, imgBuffer]
        );
        
        res.status(201).send({
            message: 'Utente registrato',
        });
    } catch (error) {
        console.error('Errore registrazione:', error);
        res.status(500).send({ message: 'Errore interno del server' });
    }
});

const ACCESS_TOKEN_EXPIRY_SECONDS = 60 * 15; // 15 minuti
const REFRESH_TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 giorni
const jwt_secret = process.env.JWT_SECRET || 'your_jwt_secret';

// LOGIN: 
router.post('/login', async (req, res) => {
    // #swagger.tags = ['Auth']
    // #swagger.summary = 'Login utente'
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).send({ message: 'Parametri mancanti o invalidi' });

    try {
        const user = await pool.query(
            'SELECT password FROM UTENTE WHERE username = $1',
            [username]
        );
        if (user.rowCount === 0)
            return res.status(401).send({ message: 'Credenziali sbagliate' });

        const hash = user.rows[0].password;
        const valid = await bcrypt.compare(password, hash);
        if (!valid)
            return res.status(401).send({ message: 'Credenziali sbagliate' });

        const accessPayload = { username };
        const accessToken = jwt.sign(accessPayload, jwt_secret, { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS });

        const refreshScadenza = Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000;

        const refreshPayload = { username, exp: Math.floor(refreshScadenza / 1000) };
        const refreshToken = jwt.sign(refreshPayload, jwt_secret);

        await pool.query(
            `INSERT INTO SESSIONE (username, access_token, refresh_token, timestamp_inizio, timestamp_fine, refresh_scadenza)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, NULL, to_timestamp($4 / 1000.0))`,
            [username, accessToken, refreshToken, refreshScadenza]
        );

        res.send({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
    } catch (err) {
        console.error('Errore login:', err);
        return res.status(500).send({ message: 'Query error.' });
    }
});

// REFRESH TOKEN
router.post('/refresh', async (req, res) => {
    // #swagger.tags = ['Auth']
    // #swagger.summary = 'Rinnova il token'
    if (!req.body || !req.body.refresh_token)
        return res.status(400).send({ message: 'Parametri mancanti o invalidi' });

    let payload;
    try {
        payload = jwt.verify(req.body.refresh_token, jwt_secret);
    } catch {
        return res.status(401).send({ message: 'Refresh token non valido' });
    }
    const username = payload?.username;
    const refreshExp = payload?.exp;
    if (!username || !refreshExp) return res.status(401).send({ message: 'Refresh token non valido' });

    try {
        const session = await pool.query(
            `SELECT refresh_token, refresh_scadenza FROM SESSIONE
             WHERE username = $1 AND timestamp_fine IS NULL
             ORDER BY timestamp_inizio DESC LIMIT 1`,
            [username]
        );
        if (session.rowCount === 0)
            return res.status(401).send({ message: 'Sessione non trovata' });

        const dbRefreshToken = session.rows[0].refresh_token;
        const dbRefreshScadenza = session.rows[0].refresh_scadenza;

        if (req.body.refresh_token !== dbRefreshToken) {
            return res.status(401).send({ message: 'Refresh token non valido' });
        }

        const now = Math.floor(Date.now() / 1000);
        let refreshTokenExpired = false;
        if (refreshExp < now || (dbRefreshScadenza && now > Math.floor(new Date(dbRefreshScadenza).getTime() / 1000))) {
            refreshTokenExpired = true;
        }

        const newRefreshExpiresAt = Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000;
        const newRefreshPayload = { username, exp: Math.floor(newRefreshExpiresAt / 1000) };
        const newRefreshToken = jwt.sign(newRefreshPayload, jwt_secret);
        const accessPayload = { username };
        const newAccessToken = jwt.sign(accessPayload, jwt_secret, { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS });
      
        await pool.query(
            `UPDATE SESSIONE SET access_token = $1, refresh_token = $2, refresh_scadenza = to_timestamp($3 / 1000.0)
             WHERE username = $4 AND refresh_token = $5 AND timestamp_fine IS NULL`,
            [newAccessToken, newRefreshToken, newRefreshExpiresAt, username, dbRefreshToken]
        );

        return res.send({
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            refresh_expires_at: newRefreshExpiresAt,
            expires_in: ACCESS_TOKEN_EXPIRY_SECONDS,
            refresh_token_expired: refreshTokenExpired 
        });
    } catch (err) {
        console.error('Errore refresh:', err);
        return res.status(500).send({ message: 'Query error.' });
    }
});

// LOGOUT: chiude la sessione
router.post('/logout',  authMiddleware, async (req, res) => {
    // #swagger.tags = ['Auth']
    // #swagger.summary = 'Logout utente'
    // #swagger.security = [{ "bearerAuth": [] }]
    const authUser = req.user; //username e access_token
    const { username } = req.body;

    if (!username || !authUser || !authUser.username || !authUser.access_token) {
        return res.status(403).json({ error: 'Accesso negato' });
    }
    if (username !== authUser.username) {
        return res.status(403).json({ error: 'Accesso negato: lo username non corrisponde al token' });
    }
    try {
        const result = await pool.query(
            `UPDATE SESSIONE SET timestamp_fine = CURRENT_TIMESTAMP 
             WHERE username = $1 AND access_token = $2 AND timestamp_fine IS NULL`,
            [authUser.username, authUser.access_token]
        );
        if (result.rowCount === 0) {
            return res.status(404).send({ message: 'Sessione non trovata o già chiusa' });
        }
        return res.send({ message: 'Logout effettuato' });
    } catch (err) {
        return res.status(500).send({ message: 'Errore nella richiesta' });
    }
});

// ======================
// UTENTE
// ======================

router.put('/user/image', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Utente']
    // #swagger.summary = 'Aggiorna immagine profilo (richiede base64, max 100KB)'
    let { immagine_profilo } = req.body;
    let buffer;
    try {
        buffer = base64ToBufferWithSizeCheck(immagine_profilo);
    } catch (e) {
        return res.status(e.message.startsWith('Immagine troppo grande') ? 413 : 400).send({ message: e.message });
    }
    try {
        await pool.query(
            'UPDATE UTENTE SET immagine_profilo = $1, versione_immagine = COALESCE(versione_immagine, 0) + 1 WHERE username = $2',
            [buffer, req.user.username]
        );
        res.send({ message: 'Immagine profilo aggiornata' });
    } catch (e) {
        console.error(e);
        res.status(500).send({ message: 'Errore nel caricamento immagine' });
    }
});


router.get('/user/:username/image', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Utente']
    // #swagger.summary = 'Ottieni immagine profilo di un utente (base64)'
    const { username } = req.params;

    const result = await pool.query(
        'SELECT immagine_profilo, versione_immagine FROM UTENTE WHERE username = $1',
        [username]
    );
    if (result.rowCount === 0) return res.status(404).send({ message: 'Utente non trovato' });

    const img = result.rows[0].immagine_profilo;
    const versione = result.rows[0].versione_immagine;
    if (!img) {
        return res.send({ immagine_profilo: null });
    }

    res.send({
         immagine_profilo: Buffer.from(img).toString('base64'),
         versione_immagine: versione
    });

});

router.get('/user/search', async (req, res) => {
    // #swagger.tags = ['Utente']
    // #swagger.summary = 'Ricerca utente per username'
    const { username } = req.query; 
    if (!username) return res.status(400).send({ message: 'Parametro di ricerca mancante' });

    const result = await pool.query(
        "SELECT 1 FROM UTENTE WHERE username = $1 LIMIT 1",
        [username]
    );

    return res.status(200).send({ message: `L'username ${username} ${result.rowCount > 0 ? 'esiste' : 'non esiste'}` });
});

router.get('/user/:username', async (req, res) => {
    // #swagger.tags = ['Utente']
    // #swagger.summary = 'Dati pubblici di un utente'
    const { username } = req.params;
    const user = await pool.query(
        'SELECT username, email, immagine_profilo FROM UTENTE WHERE username = $1',
        [username]
    ); 
    if (user.rowCount === 0) return res.status(404).send({ message: 'Utente non trovato' });
    res.send(user.rows[0]); 
});

router.get('/user/:username/post', async (req, res) => {
    // #swagger.tags = ['Utente']
    // #swagger.summary = 'Post pubblicati dall\'utente selezionato'
    const { username } = req.params; 
    const result = await pool.query(
        'SELECT * FROM POST WHERE username = $1',
        [username]
    ); 
    res.send(result.rows); 
});

// ======================
// POST
// ======================

router.get('/post/feed', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Feed post utente'
    const authUser = req.user;

    if (!authUser || !authUser.username || !authUser.access_token) {
        return res.status(403).json({ error: 'Accesso negato' });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const offset = (page - 1) * limit;

    try {
        const result = await pool.query(
            `
            SELECT p.*, u.username, u.immagine_profilo, COALESCE((SELECT COUNT(*) FROM MI_PIACE WHERE post_id = p.post_id), 0) AS numlikes
            FROM POST p
            JOIN UTENTE u ON p.autore = u.username
            LEFT JOIN (
                SELECT post_id, COUNT(*) AS numlikes
                FROM MI_PIACE
                GROUP BY post_id
            ) AS likes ON p.post_id = likes.post_id
            WHERE
                (p.autore = $1 OR p.autore IN (
                    SELECT username_seguito FROM FOLLOWING_LIST WHERE username_seguace = $1
                ))
                AND (p.moderato IS NULL OR p.moderato = FALSE)
            ORDER BY p.timestamp_post DESC
            LIMIT $2 OFFSET $3
            `,
            [authUser.username, limit, offset]
        );

        const posts = result.rows.map(post => ({
            ...post,
            immagine: post.immagine ? Buffer.from(post.immagine).toString('base64') : null,
            immagine_profilo: post.immagine_profilo ? Buffer.from(post.immagine_profilo).toString('base64') : null
        }));

        if (posts.length === 0) {
            return res.status(404).send({ message: 'Nessun post disponibile' });
        }

        res.send(posts);
    } catch (e) {
        console.error(e);
        res.status(500).send({ message: 'Errore nel recupero dei post' });
    }
});


router.post('/post/:id/like', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Aggiungi like a un post'
    const id = parseInt(req.params.id);
    const username = req.user?.username; 

    if (!username) return res.status(401).send({ message: 'Utente non autenticato' });

    const postResult = await pool.query(
            'SELECT * FROM POST WHERE post_id = $1',
            [id]
    );
        if (postResult.rowCount === 0) {
            return res.status(404).send({ message: 'Post non trovato' });
        }

        const likeExists = await pool.query(
            'SELECT 1 FROM MI_PIACE WHERE post_id = $1 AND username = $2',
            [id, username]
        );
        if (likeExists.rowCount > 0) {
            return res.status(400).send({ message: 'Hai già messo like a questo post' });
        }

        try {
            await pool.query(
                'INSERT INTO MI_PIACE (post_id, username, timestamp_like) VALUES ($1, $2, NOW())',
                [id, username]
            );
            const countResult = await pool.query(
                'SELECT COUNT(*) AS likes FROM MI_PIACE WHERE post_id = $1',
                [id]
            );
            const likes = parseInt(countResult.rows[0].likes, 10);
            res.send({ message: 'Like aggiunto', likes }); 
            
        } catch (e) {
            console.error(e);
            res.status(500).send({ message: 'Errore nel aggiungere like' });
        }
});

router.post('/post/:id/commento', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Aggiungi commento a un post'
    const id = parseInt(req.params.id);
    const username = req.user?.username;

    let { testo } = req.body;
    if (!testo) {
        return res.status(400).send({ message: 'Devi fornire il contenuto del commento' });
    }

    if (!username) return res.status(401).send({ message: 'Utente non autenticato' });
    const postResult = await pool.query(
        'SELECT * FROM POST WHERE post_id = $1',
        [id]
    );
    if (postResult.rowCount === 0) {
        return res.status(404).send({ message: 'Post non trovato' });
    }
    try {
        await pool.query (
            'INSERT INTO COMMENTO (commento_id, post_id, username, testo, timestamp_commento) VALUES ((SELECT COALESCE(MAX(commento_id), 0) + 1 FROM COMMENTO), $1, $2, $3, NOW()) RETURNING commento_id',
            [id, username, testo]
        );
        const countResult = await pool.query(
            'SELECT COUNT(*) AS comments FROM COMMENTO WHERE post_id = $1',
            [id]
        );
        const comments = parseInt(countResult.rows[0].comments, 10); 
        res.send({ message: 'Commento pubblicato'});
    } catch (e) {
        console.error(e);
        res.status(500).send({ message: 'Errore nel aggiungere il commento' });
    }
});

router.post('/post/:post_id/likeComment', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Aggiungi like a un commento'
    const post_id = parseInt(req.params.id);
    let { commento_id } = req.body;
    const username_liker = req.user?.username; 
    let { username_commentatore } = req.body;

    if (!username_liker) return res.status(401).send({ message: 'Utente non autenticato' });

    const commentResult = await pool.query(
            'SELECT * FROM COMMENTO WHERE post_id = $1 AND commento_id = $2',
            [post_id, commento_id]
    );
    if (commentResult.rowCount === 0) {
        return res.status(404).send({ message: 'Commento non trovato' });
    }

        const commentExists = await pool.query(
            'SELECT 1 FROM LIKE_COMMENTO WHERE commento_id = $1 AND username_liker = $2',
            [commento_id, username_liker]
        );
        if (commentExists.rowCount > 0) {
            return res.status(400).send({ message: 'Hai già messo like a questo commento' });
        }

        try {
            await pool.query(
                'INSERT INTO LIKE_COMMENTO (post_id, commento_id, username_commentatore, username_liker, timestamp_like_com) VALUES ($1, $2, $3, $4, NOW())',
                [post_id, commento_id, username_liker, username_commentatore]
            );
            const countResult = await pool.query(
            'SELECT COUNT(*) AS comments FROM LIKE_COMMENTO WHERE commento_id = $1',
            [commento_id]
        );
        const comments = parseInt(countResult.rows[0].comments, 10); 
        res.send({ message: 'Like al commento aggiunto'}); 
            
        } catch (e) {
            console.error(e);
            res.status(500).send({ message: 'Errore nel aggiungere like al commento' });
        }
});

router.post('/post', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Crea nuovo post'
    let { testo, immagine } = req.body; 
    if (!testo && !immagine) {
        return res.status(400).send({ message: 'Devi fornire almeno testo o immagine' });
    }

    let imgBuffer = null;
    if (immagine) {
        
        if (immagine.startsWith('data:')) {
            immagine = immagine.split(',')[1];
        }
        try {
            imgBuffer = Buffer.from(immagine, 'base64');
        } catch (e) {
            return res.status(400).send({ message: 'Immagine base64 non valida' });
        }
    }

    try {
        const result = await pool.query(
            'INSERT INTO POST (testo, immagine, autore, timestamp_post, post_id) VALUES ($1, $2, $3, NOW(), (SELECT COALESCE(MAX(post_id), 0) + 1 FROM POST)) RETURNING post_id',
            [testo || null, imgBuffer || null, req.user.username]
        );
        res.status(201).send({ id: result.rows[0].post_id, message: 'Post creato' });
    } catch (e) {
        console.error(e);
        res.status(500).send({ message: 'Errore nella creazione del post' });
    }
});

router.get('/post/:id', async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Dettaglio post'
    const { id } = req.params; 
    const result = await pool.query(
        'SELECT * FROM POST WHERE post_id = $1',
        [id]
    );
    if (result.rowCount === 0) return res.status(404).send({ message: 'Post non trovato' });

    const post = result.rows[0];
    
    res.send({
        ...post,
        testo: post.testo,
        immagine: post.immagine ? Buffer.from(post.immagine).toString('base64') : null
    });
});

router.delete('/post/:id/like', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Rimuovi like'
    const { id } = req.params; 
    await pool.query(
        'DELETE FROM MI_PIACE WHERE post_id = $1 AND username = $2',
        [id, req.user.username]
    );
    res.send({ message: 'Like rimosso' });
});

router.delete('/post/:post_id/commento', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Rimuovi commento'
    const { post_id } = req.params;
    let { commento_id } = req.body;
    const username = req.user?.username;

    if (!username) return res.status(401).send({ message: 'Utente non autenticato' });

    const commentExists = await pool.query(
            'SELECT 1 FROM COMMENTO WHERE post_id = $1 AND commento_id = $2 AND username = $3',
            [post_id, commento_id, username]
    );
    if (commentExists.rowCount === 0) return res.status(404).send({ message: 'Non hai ancora commentato questo post' });

    await pool.query(
        'DELETE FROM COMMENTO WHERE post_id = $1 AND commento_id = $2 AND username = $3',
        [post_id, commento_id, req.user.username]
    );
    res.send({ message: 'Commento rimosso' })
});

router.get('/post/:id/like', async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Numero like post'
    const { id } = req.params; 
    const result = await pool.query(
        'SELECT COUNT(*) FROM COMMENTO WHERE post_id = $1',
        [id]
    ); 
    res.send({ comments: parseInt(result.rows[0].count, 10) });
});


router.get('/post/:id/commento', async (req, res) => {
    // #swagger.tags = ['Post']
    // #swagger.summary = 'Numero commenti post'
    const { id } = req.params; 
    const result = await pool.query(
        'SELECT COUNT(*) FROM COMMENTO WHERE post_id = $1',
        [id]
    ); 
    res.send({ comments: parseInt(result.rows[0].count, 10) });
});

// ======================
// FOLLOW
// ======================


router.post('/user/:username/follow', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Follow']
    // #swagger.summary = 'Segui un utente'
    const { username } = req.params;
    if (username === req.user.username) return res.status(400).send({ message: 'Non puoi seguire te stesso' });
    await pool.query(
        'INSERT INTO FOLLOWING_LIST (username_seguace, username_seguito, timestamp_following) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
        [req.user.username, username]
    );
    res.send({ message: `Ora segui ${username}` });
});


router.delete('/user/:username/follow', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Follow']
    // #swagger.summary = 'Smetti di seguire un utente'
    const { username } = req.params;
    await pool.query(
        'DELETE FROM FOLLOWING_LIST WHERE username_seguace = $1 AND username_seguito = $2',
        [req.user.username, username]
    );
    res.send({ message: `Non segui più ${username}` });
});


router.get('/user/:username/following', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Follow']
    // #swagger.summary = 'Lista o numero utenti seguiti'
    const { username } = req.params;
    const following = await pool.query(
        'SELECT username_seguito FROM FOLLOWING_LIST WHERE username_seguace = $1',
        [username]
    );
    res.send(following.rows.map(r => r.username_seguito));
});


router.get('/user/:username/follower', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Follow']
    // #swagger.summary = 'Lista o numero follower'
    const { username } = req.params;
    const follower = await pool.query(
        'SELECT username_seguace FROM FOLLOWING_LIST WHERE username_seguito = $1',
        [username]
    );
    res.send(follower.rows.map(r => r.username_seguace));
});

// ======================
// FLAG E MODERAZIONE
// ======================

router.post('/post/:id/flag', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Flag']
    // #swagger.summary = 'Flagga un post'
    const { id } = req.params; 
    await pool.query(
        'INSERT INTO FLAG (post_id, username, timestamp_flag) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING',
        [id, req.user.username]
    ); 
    res.send({ message: 'Post flaggato' });
});

router.delete('/post/:id/flag', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Flag']
    // #swagger.summary = 'Rimuovi flag da un post'
    const { id } = req.params; 
    await pool.query(
        'DELETE FROM FLAG WHERE post_id = $1 AND username = $2',
        [id, req.username]
    ); 
    res.send({ message: 'Flag rimosso' });
});

router.get('/flag/postFlaggati', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Flag']
    // #swagger.summary = 'Lista post flaggati (per moderatori)'
    const user = req.user.username;
    let ruolo; 
    try {
        const result = await pool.query(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM ADMIN WHERE username = $1) THEN 'admin' WHEN EXISTS (SELECT 1 FROM moderatore WHERE username = $1) THEN 'moderatore' ELSE NULL END AS ruolo", [user]
        );
        ruolo = result.rows[0].ruolo;
        if (!ruolo) return res.status(403).send({ message: 'Non autorizzato' });
    } catch (error) {
        console.error('Errore recupero ruolo:', error);
        return res.status(500).send({ message: 'Errore interno del server' });
    }

    if (!['moderatore', 'admin'].includes(ruolo)) return res.status(403).send({ message: 'Non autorizzato' });
    try {
        const result = await pool.query(
            `SELECT p.*, p.autore, COUNT(f.*) AS num_flags
            FROM POST p
            JOIN FLAG f ON p.post_id = f.post_id

            WHERE p.moderato IS NULL OR p.moderato = FALSE
            AND p.flaggato = TRUE
            GROUP BY p.post_id, p.autore
            ORDER BY num_flags DESC`
        );
        res.send(result.rows);
    } catch (error) {
        console.error('Errore recupero post flaggati:', error);
        res.status(500).send({ message: 'Errore interno del server' });
    }
});

router.put('/flag/:id/moderaPost', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Flag']
    // #swagger.summary = 'Modera un post (solo moderatori/admin)'
    const user = req.user.username;
    let ruolo; 
    try {
        const result = await pool.query(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM ADMIN WHERE username = $1) THEN 'admin' WHEN EXISTS (SELECT 1 FROM moderatore WHERE username = $1) THEN 'moderatore' ELSE NULL END AS ruolo", [user]
        );
        ruolo = result.rows[0].ruolo;
        if (!ruolo) return res.status(403).send({ message: 'Non autorizzato' });
    } catch (error) {
        console.error('Errore recupero ruolo:', error);
        return res.status(500).send({ message: 'Errore interno del server' });
    }
    if (!['moderatore', 'admin'].includes(ruolo)) return res.status(403).send({ message: 'Non autorizzato' });
    const { id } = req.params;
    await pool.query(
        'UPDATE POST SET moderato = TRUE, flaggato = FALSE WHERE post_id = $1',
        [id]
    );
    res.send({ message: 'Post moderato' });
});

// ======================
// MODERATORI E ADMIN
// ======================

router.post('/moderatore', authMiddleware, async (req, res) => {
    // #swagger.tags = ['Moderatore']
    // #swagger.summary = 'Nomina nuovo moderatore (solo admin)'
    const user = req.user.username;
    let ruolo; 
    try {
        const result = await pool.query(
            "SELECT CASE WHEN EXISTS (SELECT 1 FROM ADMIN WHERE username = $1) THEN 'admin' WHEN EXISTS (SELECT 1 FROM moderatore WHERE username = $1) THEN 'moderatore' ELSE NULL END AS ruolo", [user]
        );
        ruolo = result.rows[0].ruolo;
        if (!ruolo) return res.status(403).send({ message: 'Non autorizzato' });
    } catch (error) {
        console.error('Errore recupero ruolo:', error);
        return res.status(500).send({ message: 'Errore interno del server' });
    }

    if (ruolo !== 'admin') return res.status(403).send({ message: 'Non autorizzato' });
    const { username } = req.body; // Estrae username da nominare
    await pool.query(
        'INSERT INTO moderatore (username, timestamp_nomina, ADMIN_username) VALUES ($1, NOW(), $2)',
        [username, user]
    ); // Aggiorna ruolo utente a moderatore
    res.send({ message: `${username} è ora moderatore` });
});

module.exports = router;