# Progetto Fotogram – Basi di Dati e Web A.A. 2024/2025

## Introduzione
Il progetto d’esame di laboratorio del corso Basi di Dati 2024/2025 prevede la progettazione e realizzazione di una base di dati e delle relative API REST per il social network Fotogram, orientato alla condivisione di immagini. La piattaforma consente la pubblicazione di post, l’interazione tra utenti tramite like e follow, e introduce meccanismi di moderazione dei contenuti. Gli utenti possono autenticarsi tramite login, avviando una nuova sessione, e terminare la sessione tramite logout. I post possono essere segnalati per contenuti inappropriati tramite flag, e sono previsti ruoli speciali, moderatori e amministratori, incaricati della gestione e risoluzione di tali segnalazioni. Infine, l’interazione sociale tra utenti avviene possibilità di seguire altri utenti e mettere “mi piace” ai post.

## 1. Progettazione e implementazione della base di dati: schema ER
Lo schema ER (Entity-Relationship) rappresenta il modello concettuale della base di dati, illustrando le entità coinvolte, le relazioni tra esse, gli attributi associati e i vincoli di cardinalità. Per il social network Fotogram, lo schema ER può essere suddiviso in due macroaree:

### Entità relative alla gestione dell’account
- **UTENTE:** entità principale che rappresenta ogni utente registrato.  
- **SESSIONE:** entità che rappresenta una sessione di login attiva o passata, legata all’utente.  
- **FOLLOWING_LIST:** entità che rappresenta il follow tra gli utenti.  
- **MODERATORE e ADMIN:** entità legate a ruoli specifici, assegnati ad alcuni utenti.

### Entità relative all’interazione con i contenuti
- **POST:** entità che rappresenta ogni contenuto condiviso (testo e/o immagine).  
- **MI_PIACE:** entità che rappresenta il “like” di un’utente su un post.  
- **FLAG:** entità che indica una segnalazione di un contenuto inappropriato.  
- **MODERAZIONE:** entità che rappresenta l’azione di moderazione esercitata su un post da parte di un moderatore.

## 1.1 Schema ER: gestione account (UTENTE, SESSIONE, FOLLOWING_LIST, MODERATORE e ADMIN)
L’entità **UTENTE** è l’entità principale dello schema ER e rappresenta ciascun individuo registrato all’interno del social network “fotogram”, in cui un utente per registrarsi deve fornire mail, username e password. Poiché secondo le specifiche di progetto, mail e username non possono essere duplicati, l’idea iniziale era di usare una chiave primaria composta da entrambi. Tuttavia, per semplicità e per evitare ridondanze, ho scelto di utilizzare solo **username** come chiave primaria, mantenendo comunque il vincolo di unicità su entrambi gli attributi.

Insieme agli attributi non nulli abbiamo **timestamp_user**, che memorizza data e ora esatta di registrazione utente, e **ruolo**, che definisce il tipo di utente. Esistono tre tipi di ruoli: moderatore, admin (o amministratore), e utente standard, definiti nel dettaglio più avanti.

Al momento della registrazione, ad ogni utente viene assegnata un'immagine di profilo standard predefinita, uguale per tutti. L'attributo **immagine_profilo** memorizza l'immagine in formato binario (byte array) col vincolo che deve avere un peso minore di 100kb, all'interno del database. L'utente ha successivamente la possibilità di personalizzare l'immagine di profilo.

Per ottimizzare le performance del sistema e ridurre il carico di richieste al database, è stato introdotto l'attributo **versione_immagine**, un intero che rappresenta in modo incrementale la versione corrente dell’immagine di profilo dell’utente. Tale meccanismo permette una gestione più efficiente della cache delle immagini da parte del web server.

In particolare, il web server conserva nel proprio file system una copia dell’immagine di profilo e il relativo numero di versione. Quando viene effettuata una richiesta per l’immagine di profilo di un utente, il web server confronta la versione locale con quella presente nel database. Se le versioni coincidono, l’immagine viene servita direttamente dal file system, evitando l’accesso al database. In caso di discrepanza, il web server recupera la nuova immagine dal database, la memorizza nel file system sovrascrivendo la versione precedente e aggiorna il numero di versione associato.

Questo approccio consente di migliorare la scalabilità del sistema, ridurre la latenza nelle risposte e minimizzare l'accesso concorrente al database per contenuti statici come le immagini di profilo.

Per quanto riguarda la gestione degli utenti limitati, ho aggiunto l’attributo opzionale **limitato**, ossia un valore booleano che indica se un utente ha subito restrizioni: un utente viene limitato se, nell’arco di 30 giorni, ha ottenuto 3 post moderati; in questo caso non può creare nuovi post (questo vincolo non è rappresentabile direttamente nello schema ER, ma verrà applicato in fase di progettazione delle API REST).

Un utente per poter effettuare qualsiasi operazione dev’essere loggato, in altre parole deve avere cominciato una sessione, per questo motivo ho deciso di inserire l’entità **SESSIONE**, per tenere traccia di ogni accesso.

L’entità **SESSIONE** è identificata dalla combinazione della chiave primaria **access_token**, che permette di autenticare l’utente in fase di login, e di un identificatore esterno che fa riferimento all’utente. In più, alla scadenza dell’access token viene utilizzato un **refresh_token** che permette di ottenerne uno nuovo senza dover effettuare nuovamente il login. Questa scelta consente di storicizzare e distinguere tutte le sessioni associate ad un singolo utente.

Questa entità include tre attributi temporali:
- **timestamp_inizio**, che indica il momento di inizio della sessione;
- **timestamp_fine** (opzionale), che rappresenta il momento di chiusura della sessione, dato che un utente loggato potrebbe aver avviato una sessione senza averla ancora terminata;
- **refresh_scadenza**, che definisce fino a quando l’access token sarà valido. Alla scadenza del timestamp verrà generato un nuovo access token.

Un utente può non aver mai iniziato una sessione (0,1), mentre ogni sessione è associata a un solo utente (1,1). 

Un utente può seguire ed essere seguito da più utenti, per cui ho definito l’entità **FOLLOWING_LIST**.

L’entità **FOLLOWING_LIST** rappresenta le relazioni di “follow” tra utenti all’interno del social network. Per modellare questa relazione, ho scelto di introdurre un'entità autonoma piuttosto che una semplice relazione binaria tra utenti, così da poter tenere traccia delle informazioni riguardanti le azioni di follow tra gli utenti. L’entità include l’attributo **timestamp_following** che registra la data e l’ora esatta in cui è avvenuta l’azione di follow, in modo da poter ricostruire la cronologia delle connessioni tra gli utenti.

**Following_list** è collegata all’entità utente attraverso due relazioni distinte:
- **SEGUACE**, che rappresenta chi segue l’utente;
- **SEGUITO**, che rappresenta l’utente che è stato seguito.

L’entità **following_list** è definita da una coppia univoca “seguace-seguito”, in modo tale che viene imposto un vincolo: un utente può seguire un altro utente una e una sola volta e, di conseguenza, un utente può essere seguito da un altro utente una e una sola volta. Per questo motivo, ho inserito due identificatori esterni verso l’entità utente tramite entrambe le relazioni di seguace e seguito. Inoltre, è importante imporre il vincolo secondo cui un utente non può seguire sé stesso, che però verrà gestito in fase di progettazione delle API REST.

Come accennato in precedenza, esistono tre tipi di utente: moderatore, admin (o amministratore), e utente standard. Per rappresentare al meglio queste categorie, ho utilizzato una generalizzazione parziale ed esclusiva dell’entità utente: solo alcuni utenti possono assumere il ruolo di admin o moderatore, e ciascun utente può appartenere al massimo ad una di queste due categorie.

L’entità **MODERATORE** rappresenta gli utenti con poteri di moderazione, mentre l’entità **ADMIN** rappresenta gli utenti con gli stessi poteri dei moderatori, ma in più ha il ruolo di amministratore: nominare un moderatore. Un admin può nominare più moderatori o non averne ancora nominati (0,N), mentre un moderatore può essere nominato solo da un solo admin (1,1).

Per tenere traccia di queste nomine, ho messo in relazione admin e moderatore tramite l’associazione **NOMINA**, che include l’attributo **timestamp_nomina**, utile per memorizzare data e ora esatta della nomina. In una versione iniziale, avevo ipotizzato di salvare direttamente lo username dell’admin che ha effettuato la nomina all’interno dell’entità moderatore, ma ho ritenuto questa informazione ridondante, poiché già implicita nella relazione nomina. Piuttosto, ho preferito tenere traccia dello username di chi modera un determinato post nell’entità **MODERAZIONE**, che descriverò nel dettaglio più avanti.

---

## 1.2 Schema ER: interazione con i contenuti (POST, MI_PIACE, FLAG, MODERAZIONE)

L’entità **POST** rappresenta ogni contenuto pubblicato dagli utenti all’interno della piattaforma. Ogni post può contenere un testo, un’immagine (memorizzata in byte) oppure entrambi, per questo motivo gli attributi opzionali **testo** e **image** sono stati definiti come opzionali.

Un utente può pubblicare più post (0,N), ma un post può essere associato ad un solo utente (1,1). Per identificare l’entità, ho deciso di inserire come chiave primaria l’attributo **post_ID**, un codice univoco che permette di distinguere ogni contenuto nel social network.

Anche per questa entità ho deciso di inserire un attributo **timestamp_post** per tenere traccia di data e ora di pubblicazione del post, permettendo così di ricostruire la cronologia delle attività.

Infine, l’entità post presenta due attributi booleani:
- **Flaggato**, che indica se il post è stato segnalato da almeno un utente;
- **Moderato**, che indica se il contenuto è stato oggetto di intervento da parte di un moderatore.

In particolare, questi due attributi servono per comprendere lo stato di ciascun post e sono legati alle entità **FLAG** e **MODERAZIONE**, descritte nel dettaglio più avanti.

Un utente può interagire con i post di altri utenti mettendo “mi piace”, ed eventualmente rimuoverlo. Inizialmente, l’idea era quella di inserire una semplice associazione tra utente e post, in questo modo sarebbe stato più complicato tenere traccia di quali persone mettono like a un singolo post, e tanto meno a quali post mette like un generico utente. La soluzione è stata quella di reificare l’associazione e trasformarla in un’entità autonoma denominata **MI_PIACE**.

L’entità **MI_PIACE** rappresenta quindi l’azione con cui un utente aggiunge “mi piace” (o like) a un determinato post. Ogni like è associato in modo univoco a una coppia utente-post, per garantire che un utente possa mettere “mi piace” a uno specifico contenuto una sola volta.

Per tenere traccia del momento in cui è stato espresso l’apprezzamento, ho inserito l’attributo **timestamp_like**, che registra data e ora esatte dell’azione.

Ogni utente può mettere “mi piace” a più post e ogni post può ricevere “mi piace” da più utenti. Inoltre, per garantire l’unicità del “mi piace”, in modo tale che si riferisca a un singolo utente e a un singolo post, sono stati definiti due identificatori esterni: uno verso utente (**LIKE_UTENTE**) e uno verso post (**LIKE_POST**).

Un utente può segnalare un post come inappropriato, questa segnalazione prende il nome di **flag** e viene gestita tramite l’entità **FLAG**.

L’entità **FLAG** rappresenta l’azione con cui un utente segnala un post ritenuto inappropriato, avviando un processo che può portare alla moderazione del contenuto. Ogni flag è associato univocamente a una coppia “utente-post”: un singolo utente può segnalare un determinato post una sola volta, mentre un post può essere segnalato da più utenti. 

Per garantire questa unicità, ho definito due identificatori esterni tramite le relazioni **SEGNALA** (verso utente) e **SEGNALATI** (verso post). L’entità include l’attributo **timestamp_flag**, che memorizza data e ora in cui è avvenuta la segnalazione, e un attributo opzionale **motivazione**, che consente all’utente di specificare il motivo della segnalazione.

Ogni flag gestisce lo stato di un post: se un post ha ricevuto almeno una segnalazione, verrà memorizzato nell’attributo booleano **flaggato** dell’entità post, il quale assumerà il valore true. Questo meccanismo è essenziale perché un post può essere moderato solo se è stato prima segnalato almeno una volta.

I post flaggati vengono valutati e trattati tramite l’intervento dei moderatori; l’azione di moderazione dei post viene gestita e memorizzata dall’entità **MODERAZIONE**.

---

L’entità **MODERAZIONE** rappresenta l’azione di controllo eseguita da un moderatore, tramite la relazione **MOD_MOD**, o da un admin, tramite la relazione **MOD_AM**, sui post che sono stati flaggati dagli utenti; non può essere eseguita da un normale utente.

L’entità **MODERAZIONE** tiene traccia dello username di chi modera il post tramite la relazione con **ADMIN** e con **MODERATORE**. La moderazione può essere fatta una sola volta da un singolo “moderante” (admin o moderatore); quindi, le foreign keys **ADMIN_UTENTE_Username** e **MODERATORE_UTENTE_Username** ammettono valori NULL, ma è necessario imporre il vincolo che non possano essere entrambi NULL contemporaneamente.

Per questo motivo, in fase di progettazione e implementazione delle tabelle SQL, nella tabella **moderazione** ho inserito un **CHECK** che garantisce che ogni azione di moderazione venga effettuata esclusivamente da un solo tipo di utente tra admin e moderatore, e mai da entrambi contemporaneamente.

Quindi:
- l’azione di moderazione è stata svolta da un admin, memorizzando lo username dell’admin e assegnando valore NULL a moderatore;
- oppure l’azione è stata svolta da un moderatore, memorizzando lo username del moderatore e assegnando valore NULL ad admin.

Una moderazione è identificata esternamente dal singolo post, tramite la relazione **MOD_POST**.

---

In più, l’entità **MODERAZIONE** include due attributi:
- **Timestamp_moderazione**, che registra data e ora in cui è stata effettuata l’azione di moderazione;
- **Username_moderazione**, che memorizza lo username di chi ha effettuato la moderazione del post (moderatore o admin).

Come nel caso dell’attributo **flaggato**, anche moderare un post ha effetti diretti su un altro attributo di **post**, ossia **moderato**. Quando un post viene effettivamente esaminato e, se necessario, rimosso, questo attributo viene impostato a **true**; in questo modo è possibile distinguere i post segnalati ma ancora in attesa di valutazione, da quelli già controllati.

---

## 1.3 Schema ER ristrutturato

A partire dallo schema concettuale iniziale, è stata effettuata una ristrutturazione con l’obiettivo di ottimizzare il modello, semplificare la progettazione logica e ridurre le ridondanze mantenendo intatta la funzionalità dell’applicazione.

Nel modello iniziale, i ruoli speciali dell’utente erano rappresentati da entità distinte (**MODERATORE** e **ADMIN**), collegate all’entità **UTENTE** tramite una generalizzazione parziale ed esclusiva.

Questa scelta, sebbene semanticamente corretta, introduceva complessità non necessarie nella gestione e interrogazione dei dati.

Nel modello ristrutturato, i ruoli degli utenti sono ora gestiti direttamente tramite l’attributo **ruolo** presente nell’entità **UTENTE**, con valori predefiniti all’interno di un dominio ristretto (`'utente'`, `'moderatore'`, `'admin'`).

---

## 1.4 Schema relazionale
```
UTENTE(username [PK, UNI, NOT NULL], email [UNI, NOT  NULL], password [NOT NULL], timestamp_user [NOT NULL], immagine_profilo [NOT NULL], versione_immagine [NOT NULL DEFAULT 0], ruolo [CHECK IN ('admin', 'moderatore', 'utente')], limitato [OPT DEFAULT false]);

FOLLOWING_LIST(username_seguito [PK, FK -> UTENTE(username), NOT NULL], username_seguace [PK, FK -> UTENTE(username)], timestamp_following [NOT NULL]);

SESSIONE(username [PK, FK -> UTENTE(username), NOT NULL], access_token [PK, UNI, NOT NULL], timestamp_inizio [NOT NULL], timestamp_fine [OPT], refresh_token [UNI, NOT NULL], refresh_scadenza [NOT NULL]);

ADMIN(username [PK, FK -> UTENTE(username), NOT NULL]);

MODERATORE(username [PK, FK -> UTENTE(username), NOT NULL], timestamp_nomina [NOT NULL], ADMIN_username [FK -> ADMIN(username), NOT NULL]);

POST(post_id [PK, NOT NULL], timestamp_post [NOT NULL], moderato [NOT NULL, DEFAULT false], flaggato [NOT NULL, DEFAULT false], testo [OPT], immagine [OPT], username [FK -> UTENTE(username), NOT NULL], CHECK NOT (moderato AND flaggato));

MI_PIACE(username [PK, FK -> UTENTE(username), NOT NULL], post_id [PK, FK -> POST(post_id), NOT NULL], timestamp_like [NOT NULL]);

FLAG(username [PK, FK -> UTENTE(username), NOT NULL], post_id [PK, FK -> POST(post_id), NOT NULL], motivazione [OPT], timestamp_flag [NOT NULL]);

MODERAZIONE(post_id [PK, FK -> POST(post_id), NOT NULL], timestamp_moderazione [NOT NULL], ADMIN_username [OPT, FK -> ADMIN(username)], MODERATORE_username [OPT, FK -> MODERATORE(username)], CHECK (solo uno tra ADMIN_username e MODERATORE_username NOT NULL)).

```
---

**LEGGENDA:**  
PK = Primary Key,  
FK = Foreign Key,  
OPT = Attributo opzionale,  
UNI = Valore unico,  
NOT NULL = Valore non nullo,  
DEFAULT = Valore di default,  
CHECK = Vincolo di controllo.


# 📘 Documentazione delle API REST e delle query SQL

## 🔧 Tecnologie utilizzate

- **Node.js** con **Express**
- **PostgreSQL** (driver `pg`)
- **bcrypt** per hash delle password
- **jsonwebtoken** per JWT
- **crypto** per generazione segreti dinamici

---
## 🛠️ Funzioni
### `authMiddleware(req, res, next)`

Questa funzione authMiddleware è un Middleware di autenticazione che protegge le rotte verificando la validità dell’access token JWT e la presenza di una sessione attiva nel database.

- **Estrae il token JWT:** dall'header Authorization della richiesta tramite `Authorization: Bearer <access_token>`;
- **Verifica:** se il token è valido tramite `jwt.verify` e controlla nel database che esista una sessione attiva associata a quel token. Se la sessione è valida, aggiunge `username` all'oggetto `req` per l'uso nei middleware/route successivi;
- **Errori:**
  - `401 Unauthorized` → token assente/scaduto/non valido oppure la sessione è scaduta o chiusa oppure il JWT è non valido o scaduto;
- **Header richiesto (JSON):**
```json
  Authorization: Bearer <access_token>
```

### `base64ToBufferWithSizeCheck(base64String)`
Questa funzione, base64ToBufferWithSizeCheck, serve a convertire una stringa `base64` (tipicamente usata per rappresentare immagini) in un oggetto `Buffer` di Node.js, aggiungendo un controllo sulla dimensione massima consentita (`100 KB`).
- **Rimozione:** se la stringa base64 contiene un header tipo `data:image/png;base64,...`, lo rimuove per ottenere solo la parte codificata;
- **Conversione:** prova a convertire la stringa base64 in un oggetto Buffer. Se la conversione `fallisce`, lancia un `errore`;
- **Controllo:** se il buffer risultante supera i 100 KB, lancia un errore specificando la dimensione trovata e quella massima consentita;
- **Restituzione**: se tutti i controlli sono superati, restituisce il buffer.
---

## 🔑 API REST

### `POST /register`

Registra un nuovo utente nel sistema.

- **Estrae i dati:** dal corpo della richiesta `req.body`;
- **Cifratura:** la password viene cifrata con `bcrypt`;
- **Errori e risposte:**
  - `201 Created` → utente registrato
  - `400 Bad request` → dati mancanti
  - `409 Conflict` → username o mail già esistenti
  - `500 Internal Server Error` → errore del database

- **Body richiesto (JSON):**
```json
{
  "username": "any",
  "email": "any",
  "password": "any",
  "immagine_profilo": "any"
}
```
- **Esempio di risposta (JSON):**
```json
{
  "message": "Utente registrato"
}
```
---
### `POST /login`
Effettua l'autenticazione dell'utente. Se le credenziali sono corrette, crea una nuova sessione nel database (`SESSIONE`), salvando username, access token, refresh token, timestamp di inizio e scadenza del refresh. Restituisce al client l'`access token` e il `refresh token`.

- **Riceve:** `username` e `password` dal corpo della richiesta `req.body`;
- **Verifica:** controlla che l'utente esista e che la password sia corretta tramite `bcrypt.compare`;
- **Token:** genera un `access token JWT` con durata breve (2 minuti);
- **Refresh:** calcola la scadenza del `refresh token` come timestamp (in ms) e genera un refresh token JWT con payload che include `exp` come timestamp UNIX;
- **Salvataggio sessione:** inserisce una nuova sessione nel database, includendo username, access token, refresh token e la scadenza del refresh;
- **Risposta:** restituisce `access_token`, `refresh_token`, `refreshScadenza` e `expires_in` al client.
- **Errori:**
  - `400 Bad request` → parametri mancanti o non validi
  - `401 Unauthorized` → credenziali errate
  - `500 Internal Server Error` → errore nella query

- **Body richiesto (JSON):**
```json
{
  "username": "any",
  "password": "any"
}
```
- **Esempio di risposta (JSON):**
```json
{
  "access_token": "string",
  "refresh_token": "string",
}
```
### `POST /refresh`

Rinnova e restituisce un nuovo access token e refresh token tramite il refresh token fornito, prolungando la sessione autenticata senza richiedere nuovamente le credenziali.

- **Riceve:** `refresh_token` dal corpo della richiesta (`req.body.refresh_token`).
- **Verifica parametri:** se il parametro è assente o non valido, restituisce `400 Bad Request`.
- **Decodifica:** verifica la validità del refresh token tramite `jwt.verify`. Se non valido o scaduto, restituisce `401 Unauthorized`.
- **Estrae:** username e scadenza (`exp`) dal payload del token.
- **Recupera sessione:** cerca nel database la sessione attiva dell’utente (`SESSIONE` con `timestamp_fine` NULL) e confronta il refresh token ricevuto con quello salvato.
- **Controlla scadenza:** verifica che il refresh token non sia scaduto sia lato JWT (`exp`) sia lato database (`refresh_scadenza`).
- **Genera nuovi token:** crea un nuovo access token (con scadenza breve) e un nuovo refresh token (con nuova scadenza).
- **Aggiorna sessione:** aggiorna la sessione nel database con i nuovi token e la nuova scadenza.
- **Risposta:** restituisce i nuovi token, la nuova scadenza del refresh token (`refresh_expires_at` in ms), la durata dell’access token (`expires_in` in secondi) e un flag `refresh_token_expired` che indica se il vecchio refresh token era già scaduto.
- **Errori:**
  - `400 Bad Request` → parametro mancante o non valido
  - `401 Unauthorized` → refresh token non valido, scaduto o sessione non trovata
  - `500 Internal Server Error` → errore nella query

- **Body richiesto (JSON):**
```json
{
  "refresh_token": "any"
}
```

- **Esempio di risposta (JSON):**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "refresh_expires_at": 1710000000000,
  "expires_in": 120,
  "refresh_token_expired": false
}
```
---
### `POST /logout`

Chiude la sessione autenticata di un utente, scollegandolo dal sistema. L’access token fornito viene invalidato aggiornando la tabella `SESSIONE`, impostando il campo `timestamp_fine` al momento corrente, solo se la sessione è attiva (cioè `timestamp_fine IS NULL`) e corrisponde esattamente allo username e all’access_token autenticati.
- **Autenticazione:** richiesta `Bearer token` tramite `authMiddleware`;
- **Riceve:**
  - `username` → nel body della richiesta,
  - `access_token` → tramite header Authorization;
- **Errori e risposte:**
  - `200 OK` → logout effettuato
  - `403 Forbidden` → accesso negato
  - `404 Not Found` → sessione non trovata o già chiusa
  - `500 Internal Server Error` → errore nella richiesta
- **Input header richiesto (JSON):**
  ```json
  Authorization: Bearer <access_token>
  ```
- **Input body richiesto (JSON):**
  ```json
  {
    "username": "string",
  }
  ```
- **Esempio di risposta (JSON):**
  ```json
  { "message": "Logout effettuato" }
  ```
---
### `PUT /user/image`
Aggiorna l’immagine del profilo dell’utente autenticato. Richiede un'immagine codificata in base64, con dimensione massima di 100KB. L’immagine viene convertita in buffer e salvata nel database nella tabella `UTENTE`.
- **Autenticazione:** richiesta tramite `authMiddleware`;
- **Riceve:** `immagine_profilo` dal corpo della richiesta in formato base64;
- **Validazioni:**
  - `400 Bad Request` → immagine_profilo assente o malformato
  - `413 Payload Too Large` → immagine_profilo supera 100KB
- **Aggiornamento:** il base64 viene convertito in buffer per aggiornare `immagine_profilo` per l'utente identificato da `req.username`;
- **Errori e risposte:**
  - `200 OK` → immagine aggiornata con successo
  - `400 Bad Request` → base64 non valido
  - `413 Payload Too Large` → immagine troppo grande
  - `500 Internal Server Error` → errore nella richiesta

- **Input richiesto (JSON):**
  ```json
  {
  "immagine_profilo": "stringa_base64"
  }
  ```
- **Esempio di risposta (JSON):**
  ```json
  { "message": "Immagine profilo aggiornata" }
  ```
---
### `GET /user/:username/image`
Restituisce l’immagine del profilo di un utente specificato.
L'immagine può essere restituita in formato base64 (default) oppure come buffer raw (binary) se richiesto tramite query string.
- **Parametri URL:** `:username` dell'utente di cui recuperare l'immagine;
- **Errori:**
  - `404 Not Found` → utente/immagine inesistente
- **Risposta:**
  - con `raw=true` ritorna il buffer dell'immagine
  - senza `raw` ritorna `{ immagine_profilo: "<base64_string>" }`

- **Input richiesto (JSON):**
  ```json
  {
  "immagine_profilo": "iVBORw0KGgoAAAANSUhEUgAA..."
  }

  ```
- **Esempio di risposta (JSON):**
  ```json  
  { "message": "Utente non trovato" }
  ```
---
### `GET /user/search`
Verifica se uno specifico username è registrato nel sistema.
Restituisce una risposta testuale che indica se l’username esiste oppure no.
- **Errori:**
  - `400 Bad Request` → parametro utente mancante
- **Risposta:**
  - con `raw=true` ritorna il buffer dell'immagine
  - senza `raw` ritorna `{ immagine_profilo: "<base64_string>" }`

- **Esempio di risposta (JSON):**
  ```json  
  { "message": "L'username mario esiste" }
  ```
  oppure
  ```json
  { "message": "L'username pippo non esiste" }
  ```
---

### `GET /user/:username`
Restituisce i dati pubblici di un utente identificato dallo username.
- **Parametri URL:** `:username` dell'utente di cui recuperare l'immagine;
- **Risposta:**
  - `username`
  - `email`
  - `immagine_profilo`
- **Errori:**
  - `404 Not Found` → l'utente non esiste

- **Esempio di risposta (JSON):**
  ```json  
  {
  "username": "mario",
  "email": "mario@example.com",
  "immagine_profilo": "<binary_data>"
  }
  ```
---

### `GET /user/:username/post`
Recupera tutti i post pubblicati da un utente specifico, identificato dallo `username` fornito come parametro nel percorso.
- **Parametri URL:** `:username` dell'utente dell'autore dei post;
- **Risposta:**
  - `username`
  - `email`
  - `immagine_profilo`
- **Errori:**
  - `200 OK` → restituisce i post pubblicati dall'utente, se non ne ha pubblicati restituisce un array vuota

- **Esempio di risposta (JSON):**
  ```json  
  [
  {
    "post_id": 1,
    "timestamp_post": "2025-06-05T21:14:39.887Z",
    "moderato": false,
    "flaggato": false,
    "testo": "Primo post di martina!",
    "immagine": {
      "type": "Buffer",
      "data": [
        255,
        216,
        255,
        224,
        0,
        16,
        74,
        70,
        73,
        70
      ]
    },
    "username": "martina.rossi"
  }
  ]
  ```
---
## 📝 API REST: Post
### `GET /post/feed`
Restituisce il `feed globale` dei post pubblicati dall'utente loggato e dai suoi seguiti, ordinati dal più recente al più vecchio. Ogni post include anche l'immagine profilo dell’autore, se presente.
- **Richiede:** autenticazione e numero di pagina.
- **Risposta:**
  - `200 OK` → restituisce tutti i post pubblicati da tutti gli utenti in ordine decrescente
- **Esempio di risposta (JSON):**
  ```json  
  [
  {
    "post_id": 1,
    "timestamp_post": "2025-06-05T21:14:39.887Z",
    "moderato": false,
    "flaggato": false,
    "testo": "Primo post di martina!",
    "immagine": "/9j/4AAQSkZJRg==",
    "autore": "martina.rossi",
    "username": "martina.rossi",
    "immagine_profilo": "qualcosa",
    "numlikes": "2"
  },
  {
    "post_id": 2,
    "timestamp_post": "2025-06-05T21:14:39.887Z",
    "moderato": false,
    "flaggato": true,
    "testo": "Post moderato da luca.",
    "immagine": "/9j/4AAQSkZJRg==",
    "autore": "luca.verdi",
    "username": "luca.verdi",
    "immagine_profilo": "/9j/4AAQSkZJRg==",
    "numlikes": "1"
  },
  ...
  ]
  ```
---
### `POST /post/:id/like`
Permette all’utente autenticato di mettere "like" a un post.
Il like è associato all'utente (`username`) e a un determinato post (`post_id`).
- **Autenticazione:** Richiede autenticazione tramite `authMiddleware`.
- **Risposta:**
  - `200 OK` → Like aggiunto con successo.
- **Esempio di risposta (JSON):**
  ```json  
  {
    "message": "Like aggiunto",
    "likes": <numero_like_aggiornato>
  }
  ```
---
### `POST /post`
Crea un nuovo post con testo e/o immagine.

- **Autenticazione:** Richiede che l'utente sia autenticato tramite `authMiddleware`.

- **Input richiesto (JSON):**  
```json
{
  "testo": "stringa opzionale",
  "immagine": "stringa base64 opzionale"
}
```
---

### `GET /post/:id`
Restituisce il dettaglio di un post specifico identificato dall'`id`.

- **Autenticazione:** Nessuna autenticazione richiesta.

- **Parametri URL:** id del post da recuperare.

**Risposte:**  
- `200 OK`: Post trovato con successo.  
  ```json
  {
    "post_id": <id>,
    "testo": "contenuto testo",
    "immagine": "stringa base64 o null",
    "autore": "username autore",
    "timestamp_post": "data e ora creazione",
    "likes": <numero_like>
  }
  ```
---

### `DELETE /post/:id/like`
Rimuove il like di un utente autenticato da un post specifico.

**Autenticazione:** Richiede che l'utente sia autenticato tramite `authMiddleware`.

**Parametri URL:** `id` del post da cui rimuovere il like.

**Funzionamento:**  
- Estrae l'ID del post dai parametri URL.
- Rimuove il like associato all’utente autenticato per quel post dalla tabella `MI_PIACE`.

**Risposte:**  
- `200 OK`: Like rimosso con successo.  
  ```json
  {
    "message": "Like rimosso"
  }
  ```
---

### `GET /post/:id/like`
Restituisce il numero totale di like associati a un post specifico.

**Autenticazione:** Non richiesta.

**Parametri URL:** `id` del post di cui si vogliono conoscere i like.

**Funzionamento:**  
- Estrae l’ID del post dai parametri della richiesta.
- Esegue una query sulla tabella `MI_PIACE` per contare tutti i like associati a quel `post_id`.
- Restituisce il numero totale dei like.

**Risposte:**  
- `200 OK`: Restituisce il conteggio dei like.  
  ```json
  {
    "likes": 5
  }
  ```
---
### `POST /user/:username/follow`
Permette all’utente autenticato di seguire un altro utente.

**Autenticazione:** Richiede che l'utente sia autenticato tramite `authMiddleware`.

**Parametri URL:** `username` dell’utente che si desidera seguire.

**Funzionamento:**  
- Verifica che l'utente autenticato non stia cercando di seguire sé stesso.
- Inserisce una nuova relazione nella tabella `FOLLOWING_LIST` tra l’utente autenticato (`username_seguace`) e l’utente target (`username_seguito`), con timestamp corrente.
- Se la relazione esiste già (grazie a `ON CONFLICT DO NOTHING`), non viene generato errore né duplicato.
- Restituisce un messaggio di conferma.

**Risposte:**  
- `200 OK`: Follow effettuato con successo.  
  ```json
  {
    "message": "Ora segui <username>"
  }
  ```
---
### `DELETE /user/:username/follow` 
Permette all’utente autenticato di smettere di seguire un altro utente.

**Autenticazione:** Richiede che l'utente sia autenticato tramite `authMiddleware`.

**Parametri URL:** `username` dell’utente che si desidera smettere di seguire.

**Funzionamento:**  
- Estrae l’username dell’utente da smettere di seguire dai parametri della richiesta;
- Esegue la cancellazione dalla tabella `FOLLOWING_LIST` della relazione in cui:
  - `username_seguace` è l’utente autenticato
  - `username_seguito` è l’utente indicato nel parametro;
- Restituisce un messaggio di conferma.

**Risposte:**  
- `200 OK`: Follow rimosso.  
  ```json
  {
    "message": "Non segui più <username>"
  }
  ```
---
### `GET /user/:username/following`
Restituisce l’elenco degli utenti seguiti da un determinato utente.

**Autenticazione:** Richiede che l'utente sia autenticato tramite `authMiddleware`.

**Parametri URL:** `username` dell’utente di cui si vogliono conoscere gli utenti seguiti.

**Funzionamento:**  
- Estrae l’`username` dai parametri della richiesta;
- Interroga la tabella `FOLLOWING_LIST` per recuperare tutti i `username_seguito` associati a quell’utente;
- Restituisce una lista di stringhe contenenti gli username degli utenti seguiti.

**Risposte:**  
- `200 OK`: Lista degli utenti seguiti restituita con successo.  
  ```json
  [
    "utente1",
    "utente2",
    "utente3"
  ]
  ```
---
### GET /user/:username/follower 
Restituisce l’elenco degli utenti che seguono un determinato utente (follower).

**Autenticazione:** Richiede che l'utente sia autenticato tramite `authMiddleware`.

**Parametri URL:** `username`dell’utente di cui si vogliono conoscere i follower.

**Funzionamento:**  
- Estrae l’`username` dai parametri della richiesta;
- Interroga la tabella `FOLLOWING_LIST` per recuperare tutti i `username_seguace` (i follower) associati a quell’utente;
- Restituisce una lista di stringhe contenenti gli username dei follower.

**Risposte:**  
- `200 OK`: Lista dei follower restituita con successo.  
  ```json
  [
    "follower1",
    "follower2",
    "follower3"
  ]
  ```
---
### `POST /post/:id/flag`
Permette a un utente autenticato di segnalare (flaggare) un post.

**Autenticazione:** Richiede che l'utente sia autenticato tramite `authMiddleware`.

**Parametri URL:** `id` del post da flaggare.

**Funzionamento:**  
- Estrae l’ID del post dai parametri della richiesta.
- Inserisce nella tabella `FLAG` un record con:
  - `post_id`: ID del post flaggato
  - `username`: utente autenticato che ha effettuato la segnalazione
  - `timestamp_flag`: data e ora della segnalazione
- L’inserimento è gestito con `ON CONFLICT DO NOTHING`, quindi se l’utente ha già flaggato quel post, l’operazione non ha effetto duplicato.
- Restituisce un messaggio di conferma.

**Risposte:**  
- `200 OK`: Post segnalato correttamente.  
  ```json
  {
    "message": "Post flaggato"
  }
  ```
---
### `DELETE /post/:id/flag`
Rimuove il flag associato a un post specifico per l'utente autenticato.

- **Autenticazione:** Richiede autenticazione tramite `authMiddleware`.

- **Headers:** Deve includere il token di autenticazione (gestito da `authMiddleware`).

- **Risposta:**
- `200 OK`: Flag rimosso correttamente. 
  ```json
  {
    "message": "Flag rimosso"
  }
  ```
---
### `GET /flag/postFlaggati`  
Restituisce la lista dei post flaggati non ancora moderati, accessibile solo a moderatori e admin.

**Autenticazione:** Richiede che l’utente sia autenticato tramite `authMiddleware`.

**Autorizzazione:**  
- Verifica il ruolo dell’utente (`admin` o `moderatore`) tramite query al database.  
- Se il ruolo non è uno di questi, risponde con `403 Non autorizzato`.

**Funzionamento:**  
- Controlla il ruolo dell’utente autenticato.  
- Se autorizzato, esegue una query per recuperare i post:  
  - che sono flaggati (`flaggato = TRUE`)  
  - che non sono ancora stati moderati (`moderato IS NULL OR moderato = FALSE`)  
  - conta il numero di flag per ogni post  
  - ordina i risultati in ordine decrescente di numero di flag  
- Restituisce la lista dei post con i relativi dettagli e numero di flag.

**Risposte:**  
- `200 OK`: Lista dei post flaggati e non moderati.  
  ```json
  [
    {
      "post_id": "...",
      "autore": "...",
      "num_flags": 5,
      ...
    }
  ]
  ```
---

### `PUT /flag/:id/moderaPost`  
Consente a un moderatore o admin di moderare un post specifico.

**Autenticazione:** Richiede che l’utente sia autenticato tramite `authMiddleware`.

**Autorizzazione:**  
- Verifica il ruolo dell’utente (`admin` o `moderatore`) tramite query al database.  
- Se il ruolo non è uno di questi, risponde con `403 Non autorizzato`.

**Funzionamento:**  
- Estrae l’ID del post dai parametri della richiesta.  
- Aggiorna il post nel database impostando:  
  - `moderato = TRUE`  
  - `flaggato = FALSE`  
- Invia una risposta di conferma.

**Risposte:**  
- `200 OK`: Post moderato correttamente.  
  ```json
  {
    "message": "Post moderato"
  }
  ```
---
### `POST /moderatore`  
Nomina un nuovo moderatore. Accessibile solo agli admin.

**Autenticazione:** Richiede che l’utente sia autenticato tramite `authMiddleware`.

**Autorizzazione:**  
- Verifica il ruolo dell’utente (`admin` o `moderatore`) tramite query al database.  
- Solo gli utenti con ruolo `admin` possono nominare nuovi moderatori.  
- Se il ruolo non è `admin`, risponde con `403 Non autorizzato`.

**Funzionamento:**  
- Estrae lo username dal corpo della richiesta.  
- Inserisce un nuovo record nella tabella `moderatore` con:  
  - `username`: utente nominato  
  - `timestamp_nomina`: data e ora della nomina (NOW())  
  - `ADMIN_username`: username dell’admin che ha effettuato la nomina  
- Invia una risposta di conferma.

**Risposte:**  
- `200 OK`: Moderatore nominato correttamente.  
  ```json
  {
    "message": "<username> è ora moderatore"
  }
  ```
