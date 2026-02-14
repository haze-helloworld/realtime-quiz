/* ================= SOCKET ================= */

let socket = null;

/* ================= DOM ================= */

const status = document.getElementById("status");
const quiz = document.getElementById("quiz");
const leaderboardDiv = document.getElementById("leaderboard");

const joinPanel = document.getElementById("joinPanel");
const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");

const playerNameLabel = document.getElementById("playerName");
const playerIdLabel = document.getElementById("playerId");
const identityDiv = document.getElementById("identity");

/* ================= STATE ================= */

let currentQuestion = null;
let answered = false;
let myName = "";
let resultShownForQuestion = null;

/* ================= UTIL ================= */

function showMessage(text, type="info") {
    quiz.replaceChildren();

    const div = document.createElement("div");
    div.className = "center-message " + type;
    div.innerText = text;

    quiz.appendChild(div);
}

/* ================= JOIN ================= */

joinBtn.onclick = () => {

    if (socket) return;

    myName = nameInput.value.trim();
    if (!myName) return alert("Enter a name");

    socket = io();

    socket.on("connect", () => {

        status.className = "status connected";
        status.innerText = "Connected";

        socket.emit("join_game", { name: myName });

        joinPanel.style.display = "none";
        identityDiv.style.display = "block";

        playerNameLabel.innerText = myName;
        playerIdLabel.innerText = socket.id;

        showMessage("Waiting for host to start...");
    });

    socket.on("disconnect", () => {
        status.className = "status disconnected";
        status.innerText = "Disconnected";
        showMessage("Connection lost...");
    });

    registerSocketEvents();
};

/* ================= SOCKET EVENTS ================= */

function registerSocketEvents() {

    socket.on("waiting_players", () => {
        showMessage("Waiting for more players...");
    });

    socket.on("game_started", () => {
        showMessage("Game starting...");
    });

    /* ---------- NEW QUESTION ---------- */

    socket.on("new_question", (q) => {

        currentQuestion = q;
        answered = false;
        resultShownForQuestion = null;

        quiz.replaceChildren();

        const numberDiv = document.createElement("div");
        numberDiv.className = "question-number";
        numberDiv.textContent = `Question ${q.number} / ${q.total}`;

        const questionDiv = document.createElement("div");
        questionDiv.className = "question";
        questionDiv.textContent = q.question;

        const optionsDiv = document.createElement("div");
        optionsDiv.className = "options";

        q.options.forEach((opt, index) => {

            const btn = document.createElement("button");
            btn.className = "option";
            btn.textContent = opt;

            btn.onclick = () => {

                if (answered) return;
                answered = true;

                // lock buttons but DO NOT show correctness yet
                optionsDiv.querySelectorAll("button")
                    .forEach(b => b.disabled = true);

                socket.emit("answer", {
                    questionId: q.id,
                    answer: index
                });
            };

            optionsDiv.appendChild(btn);
        });

        quiz.appendChild(numberDiv);
        quiz.appendChild(questionDiv);
        quiz.appendChild(optionsDiv);
    });

    /* ---------- WINNER (REVEAL ANSWER HERE ONLY) ---------- */

    socket.on("winner", (data) => {

        if (resultShownForQuestion === currentQuestion?.id) return;
        resultShownForQuestion = currentQuestion?.id;

        answered = true;

        const buttons = document.querySelectorAll(".option");

        // reveal correct answer to everyone
        buttons.forEach((btn, i) => {

            btn.disabled = true;

            if (i === data.correctAnswer)
                btn.classList.add("correct-option");
            else
                btn.classList.add("wrong-option");
        });

        const resultDiv = document.createElement("div");

        if (data.socketId === socket.id) {
            resultDiv.className = "result win";
            resultDiv.innerText = "🎉 Correct!";
        } else {
            resultDiv.className = "result lose";
            resultDiv.innerText = `${data.name} answered first`;
        }

        quiz.appendChild(resultDiv);
    });

    /* ---------- GAME FINISHED ---------- */

    socket.on("game_finished", ({ winners, score }) => {

        if (winners.length === 1)
            showMessage(`🏆 ${winners[0]} wins with ${score} points!`, "win");
        else
            showMessage(`🤝 Tie: ${winners.join(", ")} (${score} pts)`, "win");
    });

    /* ---------- LEADERBOARD ---------- */

    socket.on("leaderboard_update", (board) => {

        const sorted = Object.entries(board)
            .sort((a, b) => b[1].score - a[1].score);

        leaderboardDiv.replaceChildren();

        sorted.forEach(([id, player], index) => {

            const row = document.createElement("div");
            row.className = "player";

            if (id === socket.id) row.classList.add("you");

            const displayName = id === socket.id ? "You" : player.name;

            row.innerHTML = `
                <span>#${index + 1} ${displayName}</span>
                <span>${player.score}</span>
            `;

            leaderboardDiv.appendChild(row);
        });
    });
}
