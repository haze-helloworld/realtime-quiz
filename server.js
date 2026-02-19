/* ================= IMPORTS ================= */

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");

/* ================= EXPRESS ================= */

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/host", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "host.html"))
);

/* ================= SOCKET ================= */

const io = new Server(server, { cors: { origin: "*" } });
instrument(io, { auth: false, mode: "development" });

const PORT = process.env.PORT || 3000;
const HOST_PASSWORD = "teacher123";

/* ================= PLAYERS ================= */

const players = {};
let hostId = null;

/* ================= QUESTIONS ================= */

let questionBank = [
{ question: "In our YouTube comments example, why didn’t new comments appear instantly?", 
  options: ["Server crashed","HTTP closes connection after response","Browser bug","Low FPS"], correct: 1 },

{ question: "Polling meant:", 
  options: ["Server sends updates automatically","Client repeatedly asks for updates","Database caching","Opening multiple tabs"], correct: 1 },

{ question: "Long polling improved polling because:", 
  options: ["Server waits before replying","It uses UDP","It encrypts data","It removes latency completely"], correct: 0 },

{ question: "Why is polling inefficient?", 
  options: ["Too secure","Wastes requests when nothing changes","Too fast","Uses UDP"], correct: 1 },

{ question: "The HTTP → WebSocket switch happens using:", 
  options: ["200 OK","301 Redirect","101 Switching Protocols","404 Upgrade"], correct: 2 },

{ question: "After WebSocket connects, communication becomes:", 
  options: ["Request/Response","File transfer","Event based","One time only"], correct: 2 },

{ question: "In the 2-tab WebSocketKing demo, messages appeared because:", 
  options: ["Tabs shared memory","Server broadcasted events","Browser refreshed automatically","Local storage synced"], correct: 1 },

{ question: "WebSocket is full duplex means:", 
  options: ["Server talks first only","Client talks first only","Both can send anytime","Only one message per second"], correct: 2 },

{ question: "WebSocket connection stays:", 
  options: ["Closed after response","Persistent","Random","Encrypted only"], correct: 1 },

{ question: "What does wss provide?", 
  options: ["Compression","Encryption via TLS","Faster CPU","Local connection"], correct: 1 },

{ question: "WebSocket communication after connection:", 
  options: ["Needs HTTP every time","Uses events without requests","Uses database triggers","Uses refresh loop"], correct: 1 },

{ question: "HTTP is primarily?", 
  options: ["Stateful","Stateless","Persistent","Encrypted only"], correct: 1 },

{ question: "HTTP is ?", 
  options: ["Bidirectional","Unidirectional","Both","Full duplex"], correct: 1 },

{ question: "Latency affects:", 
  options: ["Only UI","Only database","Order of message arrival","CSS rendering"], correct: 2 },

{ question: "Socket.IO primarily communicates using:", 
  options: ["Events","SQL queries","Files","HTML pages"], correct: 0 },

{ question: "socket.emit(\"chat message\") means:", 
  options: ["Create database","Send event to server","Reload page","Compile code"], correct: 1 },

{ question: "socket.on(\"message\") is used to:", 
  options: ["Send event","Listen for event","Close server","Encrypt data"], correct: 1 },

{ question: "io.on(\"connection\") runs when:", 
  options: ["Server starts","Client connects","Database updates","Room closes"], correct: 1 },

{ question: "Broadcasting in chat app means:", 
  options: ["Send to only sender","Send to all connected clients","Send to database","Send to browser cache"], correct: 1 },

{ question: "Rooms in Socket.IO help:", 
  options: ["Separate groups of users","Improve CSS","Store files","Increase FPS"], correct: 0 },

{ question: "Socket.IO fallback transport is:", 
  options: ["Long polling","FTP","Bluetooth","SMTP"], correct: 0 },

{ question: "Socket.IO is built on top of:", 
  options: ["HTTP + WebSocket transport","Bluetooth","USB","SMTP"], correct: 0 },

{ question: "Realtime chat apps use:", 
  options: ["REST only","WebSocket","SMTP","ARP"], correct: 1 },

{ question: "Handshake in TCP has how many steps?", 
  options: ["1","2","3","4"], correct: 2 }
];

/* ================= GAME STATE ================= */

let gameRunning = false;
let currentQuestionIndex = -1;
let currentQuestion = null;
let answered = false;

/* 🔧 ADDED */
let questionTimer = null;
const QUESTION_TIME = 20000;

const RESULT_TIME = 2500;

/* ================= GAME FLOW ================= */

function startGame() {

    if (questionBank.length === 0) return;

    gameRunning = true;
    currentQuestionIndex = -1;

    for (const id in players)
        players[id].score = 0;

    io.emit("game_started");
    nextQuestion();
}

function nextQuestion() {

    currentQuestionIndex++;

    if (currentQuestionIndex >= questionBank.length)
        return finishGame();

    answered = false;

    const q = questionBank[currentQuestionIndex];

    currentQuestion = {
        id: Date.now(),
        number: currentQuestionIndex + 1,
        total: questionBank.length,
        ...q
    };

    console.log(`Q${currentQuestion.number}/${currentQuestion.total}`);

    io.emit("new_question", currentQuestion);

    /* 🔧 ADDED 20s timeout */
    clearTimeout(questionTimer);
    questionTimer = setTimeout(() => {

        if (answered) return;

        answered = true;

        console.log("Time expired → reveal answer");

        io.emit("time_up", {
            correctAnswer: currentQuestion.correct
        });

        setTimeout(nextQuestion, RESULT_TIME);

    }, QUESTION_TIME);
}

function finishGame() {

    gameRunning = false;
    currentQuestion = null;

    let top = -1, winners = [];

    for (const id in players) {
        if (players[id].score > top) {
            top = players[id].score;
            winners = [players[id].name];
        } else if (players[id].score === top) {
            winners.push(players[id].name);
        }
    }

    io.emit("game_finished", { winners, score: top });
}

/* ================= SOCKET EVENTS ================= */

io.on("connection", (socket) => {

    console.log("Connected:", socket.id);

    socket.on("host_login", (password) => {
        if (password !== HOST_PASSWORD)
            return socket.emit("host_denied");

        hostId = socket.id;
        socket.emit("host_approved");
        socket.emit("host_questions", questionBank);
    });

    socket.on("host_start", () => {
        if (socket.id !== hostId) return;
        startGame();
    });

    socket.on("join_game", ({ name }) => {
        players[socket.id] = { name, score: 0 };
        io.emit("leaderboard_update", players);
    });

    socket.on("answer", ({ questionId, answer }) => {

        if (!gameRunning || answered) return;
        if (!players[socket.id]) return;
        if (!currentQuestion || questionId !== currentQuestion.id) return;

        if (answer === currentQuestion.correct) {

            answered = true;
            players[socket.id].score++;

            /* 🔧 ADDED cancel timer */
            clearTimeout(questionTimer);

            console.log("Winner:", players[socket.id].name);

            io.emit("winner", {
                name: players[socket.id].name,
                socketId: socket.id,
                correctAnswer: currentQuestion.correct
            });

            io.emit("leaderboard_update", players);

            setTimeout(nextQuestion, RESULT_TIME);
        }
    });

    socket.on("disconnect", () => {
        delete players[socket.id];
        io.emit("leaderboard_update", players);
        if (socket.id === hostId) hostId = null;
    });
});

/* ================= START ================= */

server.listen(PORT, () =>
    console.log(`Server running → http://localhost:${PORT}`)
);
