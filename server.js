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

const PORT = 3000;
const HOST_PASSWORD = "teacher123";

/* ================= PLAYERS ================= */

const players = {};
let hostId = null;

/* ================= QUESTIONS ================= */

let questionBank = [
     { question: "HTTP is primarily?", options: ["Stateful","Stateless","Persistent","Encrypted only"], correct: 1 },
    { question: "Polling means:", options: ["Server pushes updates","Client repeatedly asks server","Database caching","Packet routing"], correct: 1 },
    { question: "Why is polling inefficient?", options: ["Too secure","Wastes requests when nothing changes","Too fast","Uses UDP"], correct: 1 },
    { question: "Latency affects:", options: ["Only UI","Only database","Order of message arrival","CSS rendering"], correct: 2 },
    { question: "Which protocol upgrade enables WebSocket?", options: ["DNS","HTTP Upgrade","FTP Switch","TCP Reset"], correct: 1 },
    { question: "WebSocket allows?", options: ["Only server responses","Only client requests","Bidirectional communication","File downloads only"], correct: 2 },
    { question: "WebSocket connection stays:", options: ["Closed after response","Persistent","Random","Encrypted only"], correct: 1 },
    { question: "Realtime chat apps use:", options: ["REST only","WebSocket","SMTP","ARP"], correct: 1 },
    { question: "Socket.IO is built on top of:", options: ["HTTP + WebSocket transport","Bluetooth","USB","SMTP"], correct: 0 },
    { question: "Who decides winner in a realtime quiz?", options: ["Fastest click","Client clock","Server arrival time","Browser refresh"], correct: 2 },
    { question: "In distributed systems, clients are:", options: ["Always trusted","Never trusted","The database","The router"], correct: 1 },
    { question: "TCP provides?", options: ["Unreliable delivery","Ordered reliable delivery","Only encryption","Broadcasting"], correct: 1 },
    { question: "UDP is preferred for?", options: ["Email","Video streaming","Database transactions","File storage"], correct: 1 },
    { question: "Handshake in TCP has how many steps?", options: ["1","2","3","4"], correct: 2 },
    { question: "Port number identifies?", options: ["Device","Application process","Packet size","Router"], correct: 1 },
    { question: "WebSocket reduces latency because?", options: ["No handshake","Persistent connection","Uses Bluetooth","Runs in database"], correct: 1 },
    { question: "Client clock is unreliable because?", options: ["Different timezone","Network delay","Browser bug","Screen refresh"], correct: 1 },
    { question: "Server authoritative model prevents?", options: ["Lag","Cheating","Disconnects","Compilation errors"], correct: 1 },
    { question: "Socket.IO fallback transport?", options: ["Polling","FTP","SMTP","ARP"], correct: 0 },
    { question: "Realtime multiplayer systems require?", options: ["Stateless logic","Central authority","Local storage only","Manual refresh"], correct: 1 }
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
