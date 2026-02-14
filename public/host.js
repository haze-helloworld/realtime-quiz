const socket = io();

/* ================= LOGIN ================= */

const loginBtn = document.getElementById("loginBtn");
const password = document.getElementById("password");
const panel = document.getElementById("panel");
const questionsDiv = document.getElementById("questions");

loginBtn.onclick = () => {
    socket.emit("host_login", password.value);
};

socket.on("host_approved", () => {
    document.getElementById("login").style.display = "none";
    panel.style.display = "block";
});

socket.on("host_denied", () => alert("Wrong password"));

/* ================= RECEIVE QUESTIONS ================= */

socket.on("host_questions", (list) => {

    questionsDiv.innerHTML = "";
    document.getElementById("count").innerText = list.length;

    list.forEach((q, index) => {

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <h3>${index + 1}. ${q.question}</h3>

            ${q.options.map((o,i)=>
                `<div class="${i===q.correct?'correct':''}">
                    ${i}. ${o}
                </div>`
            ).join("")}

            <button class="edit">Edit</button>
            <button class="delete">Delete</button>
        `;

        /* DELETE */

        card.querySelector(".delete").onclick = () => {
            if(confirm("Delete this question?"))
                socket.emit("host_delete_question", index);
        };

        /* EDIT */

        card.querySelector(".edit").onclick = () => {
            document.getElementById("question").value = q.question;

            document.querySelectorAll(".opt")
                .forEach((o,i)=> o.value = q.options[i]);

            document.getElementById("correct").value = q.correct;

            window.editIndex = index;
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        };

        questionsDiv.appendChild(card);
    });
});

/* ================= ADD OR EDIT ================= */

document.getElementById("add").onclick = () => {

    const q = {
        question: document.getElementById("question").value,
        options: [...document.querySelectorAll(".opt")].map(o=>o.value),
        correct: parseInt(document.getElementById("correct").value)
    };

    if(!q.question || q.options.some(o=>!o) || isNaN(q.correct))
        return alert("Fill all fields correctly");

    if(window.editIndex != null){
        socket.emit("host_edit_question", { index: window.editIndex, q });
        window.editIndex = null;
    }
    else{
        socket.emit("host_add_question", q);
    }

    document.getElementById("question").value = "";
    document.querySelectorAll(".opt").forEach(o=>o.value="");
    document.getElementById("correct").value = "";
};

/* ================= START GAME ================= */

document.getElementById("start").onclick = () =>
    socket.emit("host_start");
