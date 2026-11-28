const express = require("express");
const router = express.Router();
const db = require("../DB/db");

// Допустимые типы событий
const allowedEvents = [
    "session_start",
    "page_view",
    "product_view",
    "heartbeat",
    "page_duration",
    "product_duration"
];

// Проверка формата UUID
const isUUID = (value) => {
    return typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
};

// Регистрация пользовательской активности
router.post("/api/v1/analytics/event", async (req, res) => {

    const {
        event_id,
        visitor_id,
        session_id,
        event_type,
        page_url,
        product_id = null,
        device_type = null,
        browser = null,
        operating_system = null,
        referrer = null,
        event_data = {}
    } = req.body || {};

    // Проверка идентификаторов
    if (
        !isUUID(event_id) ||
        !isUUID(visitor_id) ||
        !isUUID(session_id)
    ) {
        return res.status(400).json({
            message: "Invalid UUID"
        });
    }

    // Проверка типа события
    if (!allowedEvents.includes(event_type)) {
        return res.status(400).json({
            message: "Invalid event type"
        });
    }

    // Проверка адреса страницы
    if (
        typeof page_url !== "string" ||
        !page_url.startsWith("/") ||
        page_url.length > 2048
    ) {
        return res.status(400).json({
            message: "Invalid page URL"
        });
    }

    // Проверка идентификатора товара
    if (
        product_id !== null &&
        (!Number.isInteger(product_id) ||
            product_id <= 0 ||
            product_id > 2147483647)
    ) {
        return res.status(400).json({
            message: "Invalid product ID"
        });
    }

    if (
        (
            event_type === "product_view" ||
            event_type === "product_duration"
        ) &&
        product_id === null
    ) {
        return res.status(400).json({
            message: "Product ID is required"
        });
    }

    // Проверка дополнительных данных
    const optionalFields = [
        [device_type, 50],
        [browser, 100],
        [operating_system, 100],
        [referrer, 2048]
    ];

    if (optionalFields.some(([value, max]) =>
        value !== null &&
        (typeof value !== "string" ||
            value.length > max)
    )) {
        return res.status(400).json({
            message: "Invalid session data"
        });
    }

    if (
        !event_data ||
        typeof event_data !== "object" ||
        Array.isArray(event_data)
    ) {
        return res.status(400).json({
            message: "Invalid event data"
        });
    }

    let client;

    // Проверка продолжительности просмотра
    if (
        event_type === "page_duration" ||
        event_type === "product_duration"
    ) {
        const duration = event_data.duration_ms;

        if (
            !Number.isSafeInteger(duration) ||
            duration <= 0
        ) {
            return res.status(400).json({
                message: "Invalid duration_ms"
            });
        }
    }

    try {
        client = await db.connect();

        // Начало транзакции
        await client.query("BEGIN");

        // 1. Регистрация посетителя
        await client.query(`
            INSERT INTO analytics.visitors (
                visitor_id,
                first_visit,
                last_visit
            )
            VALUES ($1, NOW(), NOW())
            ON CONFLICT (visitor_id)
            DO UPDATE SET
                last_visit = NOW()
        `, [visitor_id]);

        // 2. Регистрация сеанса
        const sessionResult = await client.query(`
            INSERT INTO analytics.sessions (
                session_id,
                visitor_id,
                started_at,
                last_activity,
                device_type,
                browser,
                operating_system,
                referrer
            )
            VALUES (
                $1, $2, NOW(), NOW(),
                $3, $4, $5, $6
            )
            ON CONFLICT (session_id)
            DO UPDATE SET
                last_activity = NOW()
            WHERE analytics.sessions.visitor_id =
                EXCLUDED.visitor_id
            RETURNING session_id
        `, [
            session_id,
            visitor_id,
            device_type,
            browser,
            operating_system,
            referrer
        ]);

        // Проверка принадлежности сеанса
        if (sessionResult.rowCount === 0) {
            await client.query("ROLLBACK");

            return res.status(409).json({
                message: "Session visitor mismatch"
            });
        }

        // Обработка сигнала присутствия пользователя
        if (event_type === "heartbeat") {

            await client.query("COMMIT");

            return res.status(200).json({
                message: "Heartbeat successfully registered",
                event_id: event_id
            });
        }

        // 3. Регистрация события
        const eventResult = await client.query(`
            INSERT INTO analytics.events (
                event_id,
                session_id,
                event_type,
                page_url,
                product_id,
                event_time,
                event_data
            )
            VALUES (
                $1, $2, $3, $4,
                $5, NOW(), $6::jsonb
            )
            ON CONFLICT (event_id)
            DO NOTHING
            RETURNING event_id
        `, [
            event_id,
            session_id,
            event_type,
            page_url,
            product_id,
            JSON.stringify(event_data)
        ]);

        // Проверка повторного события
        if (eventResult.rowCount === 0) {
            await client.query("ROLLBACK");

            return res.status(200).json({
                message: "Event already registered",
                event_id: event_id
            });
        }

        // Подтверждение транзакции
        await client.query("COMMIT");

        return res.status(201).json({
            message: "Event successfully registered",
            event_id: event_id
        });

    } catch (error) {

        if (client) {
            await client.query("ROLLBACK")
                .catch(console.error);
        }

        console.error("Analytics error:", error);

        if (error.code === "23503") {
            return res.status(400).json({
                message: "Referenced record does not exist"
            });
        }

        return res.status(500).json({
            message: "Analytics database error"
        });

    } finally {

        if (client) {
            client.release();
        }
    }
});

// Получение количества активных посетителей
router.get("/api/v1/analytics/online", async (req, res) => {

    try {

        const result = await db.query(`
            SELECT
                COUNT(DISTINCT visitor_id)::INTEGER
                    AS online_visitors
            FROM analytics.sessions
            WHERE last_activity >=
                NOW() - INTERVAL '90 seconds'
        `);

        return res.status(200).json({
            online_visitors:
            result.rows[0].online_visitors
        });

    } catch (error) {

        console.error(
            "Online visitors error:",
            error
        );

        return res.status(500).json({
            message: "Analytics database error",
            details: error.message,
            code: error.code
        });
    }
});

module.exports = router;