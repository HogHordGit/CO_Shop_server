// Controller-implement
const express = require("express");
const router = express.Router();
const db = require("../DB/db");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({
    extended: true
}))

//Get method
router.get("/api/v1/admins", (req, res) => {
    const sql = "Select * from acc.admins";

    db.query(sql, (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(result.rows);
    })
});

router.get("/api/v1/users", (req, res) => {
    const sql = "Select * from acc.users";

    db.query(sql, (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(result.rows);
    })
});

router.get("/api/v1/clothes", (req, res) => {
    const sql = "Select * from acc.clothes";

    db.query(sql, (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(result.rows);
    })
});

router.get("/api/v1/detail/:id", (req, res) => {
    const {id} = req.params;

    if (!id) {
        return res.status(400).json({ message: "ID are required" });
    }

    const sql = "SELECT * FROM acc.clothes WHERE id = $1";

    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error", error: err });

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid ID" });
        }

        return res.status(200).json(result.rows);
    });
})

//Post method
router.post("/api/v1/admins", (req, res) => {
    const {login, password} = req.body;
    const sql = "insert into acc.admins(login, password) VALUES ($1,$2) RETURNING *";

    db.query(sql, [login, password], (err, result) => {
        if (err) throw res.json(err);

        const user = result.rows[0];

        const token = jwt.sign(
            { id: user.id, login: user.login }, // payload
            "u92Dj#4r@9dkLS!92mdkqPz6vG!ks1Nd"
        );

        return res.status(201).json(result.rows);
    })
});

router.post("/api/v1/login", (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({ message: "Login and password are required" });
    }

    const sql = "SELECT * FROM acc.admins WHERE login = $1 AND password = $2";

    db.query(sql, [login, password], (err, result) => {
        if (err) return res.status(500).json({ message: "Database error", error: err });

        // Якщо користувача не знайдено
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid login or password" });
        }

        // Отримуємо користувача
        const user = result.rows[0];

        // Генеруємо токен
        const token = jwt.sign(
            { id: user.id, login: user.login },
            "u92Dj#4r@9dkLS!92mdkqPz6vG!ks1Nd",
            { expiresIn: "1h" } // токен діє 1 годину
        );

        // Повертаємо дані
        return res.status(200).json({
            message: "Authentication successful",
            admin: {
                id: user.id,
                login: user.login,
                token: token
            }
        });
    });
});

router.post("/api/v1/users", (req, res) => {
    const {login, password, name, balance} = req.body;
    const sql = "insert into acc.users(login, password, name, balance) VALUES ($1,$2, $3, $4) RETURNING *";

    db.query(sql, [login, password, name, balance], (err, result) => {
        if (err) throw res.json(err);
        return res.status(201).json(result.rows);
    })
});

router.post("/api/v1/clothes", (req, res) => {
    const {name, prise, rating, description, discount, size, color, img, quantity} = req.body;
    const sql = "insert into acc.clothes(name, prise, rating, description, discount, size, color, quantity, img) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *";

    db.query(sql, [name, prise, rating, description, discount, size, color, quantity, img], (err, result) => {
        if (err) throw res.json(err);
        return res.status(201).json(result.rows);
    })
});

//Put method
router.put("/api/v1/admins/:id", (req, res) => {
    const accId = Number(req.params.id);
    const {login, password} = req.body;
    const sql = "update acc.admins SET login=$1,password=$2 Where id=$3";

    db.query(sql, [login, password, accId], (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(`Item is updated successfully for id: ${accId}`);
    })
});

router.put("/api/v1/users/:id", (req, res) => {
    const accId = Number(req.params.id);
    const {login, password, name, balance} = req.body;
    const sql = "update acc.users SET login=$1,password=$2,name=$3,balance=$4 Where id=$5";

    db.query(sql, [login, password, name, balance, accId], (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(`Item is updated successfully for id: ${accId}`);
    })
});

router.put("/api/v1/clothes/:id", (req, res) => {
    const accId = Number(req.params.id);
    const {name, prise, rating, description, discount, size, color, img, quantity} = req.body;
    const sql = "update acc.clothes SET name=$1,prise=$2,rating=$3,description=$4,discount=$5,size=$6,color=$7,img=$8,quantity=$9 Where id=$10";

    db.query(sql, [name, prise, rating, description, discount, size, color, img, quantity, accId], (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(`Item is updated successfully for id: ${accId}`);
    })
});

//Delete method
router.delete("/api/v1/accounts/:id", (req, res) => {
    const id = Number(req.params.id);
    const sql = "DELETE from acc.account where id=$1";

    db.query(sql, [id], (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(`Item is deleted successfully for id: ${id}`);
    })
});

router.delete("/api/v1/admins/:id", (req, res) => {
    const id = Number(req.params.id);
    const sql = "DELETE from acc.admins where id=$1";

    db.query(sql, [id], (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(`Item is deleted successfully for id: ${id}`);
    })
});

router.delete("/api/v1/users/:id", (req, res) => {
    const id = Number(req.params.id);
    const sql = "DELETE from acc.users where id=$1";

    db.query(sql, [id], (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(`Item is deleted successfully for id: ${id}`);
    })
});

router.delete("/api/v1/clothes/:id", (req, res) => {
    const id = Number(req.params.id);
    const sql = "DELETE from acc.clothes where id=$1";

    db.query(sql, [id], (err, result) => {
        if (err) throw res.json(err);
        return res.status(200).json(`Item is deleted successfully for id: ${id}`);
    })
});

module.exports = router;