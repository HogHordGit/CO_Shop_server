const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.port || 3005;
const bodyParser = require("body-parser");

app.use(cors());

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended: true
}));

// Основной контроллер
const controller = require("./controller/controller");
app.use(controller);

// Контроллер мониторинга активности
const analyticsController = require(
    "./controller/analytics.controller"
);

app.use(analyticsController);

// Запуск сервера
app.listen(port, (err) => {
    if (err) throw err;

    console.log(`Server is running on port: ${port}`);
});