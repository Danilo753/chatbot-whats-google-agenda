const moment = require('moment');  
require('moment-timezone');       
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');


const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Whatsapp conectado!');
});


let userSession = {};


client.on('message', async message => {
    const from = message.from;  
    const userMessage = message.body.toLowerCase(); 

    if (!userSession[from]) {
        userSession[from] = { step: 1 };
    }

    switch (userSession[from].step) {
        case 1:
            message.reply('Olá! Bem-vindo à Barbearia Exemplo. Qual é o seu nome?');
            userSession[from].step = 2;
            break;
        case 2:
            userSession[from].name = userMessage; 
            message.reply(`Prazer em conhecê-lo, ${userMessage}. Qual serviço você gostaria de agendar? (corte, sobrancelha, barba, etc.)`);
            userSession[from].step = 3;
            break;
        case 3:
            userSession[from].service = userMessage;
            let duration = 30; 
            
            if (userMessage.includes('barba')) {
                duration = 20; 
            } else if (userMessage.includes('sobrancelha')) {
                duration = 15;  
            }

            userSession[from].duration = duration;
            message.reply('Qual seria o melhor horário para você? (Você pode dizer algo como "amanhã às 14:00" ou "28/10/2024 às 14:00")');
            userSession[from].step = 4;
            break;
        case 4:
            let parsedDate;

     
            if (userMessage.includes('amanhã')) {
                const tomorrow = moment().add(1, 'days').format('YYYY-MM-DD');
                const time = userMessage.match(/\d{2}:\d{2}/);  
                if (time) {
                    parsedDate = moment.tz(`${tomorrow} ${time[0]}`, 'YYYY-MM-DD HH:mm', 'America/Sao_Paulo');
                }
            } else {
               
                parsedDate = moment.tz(userMessage, 'DD/MM/YYYY HH:mm', 'America/Sao_Paulo');
            }

            if (parsedDate && parsedDate.isValid()) {
                const startDateTime = parsedDate.toISOString();  
                const endDateTime = moment(startDateTime).add(userSession[from].duration, 'minutes').toISOString();

                
                const available = await checkAvailability(startDateTime, endDateTime);
                if (available) {
                    const link = await createEvent(userSession[from].name, userSession[from].service, startDateTime, endDateTime);
                    message.reply(`Agendamento confirmado para ${userSession[from].service} no dia ${parsedDate.format('DD/MM/YYYY')} às ${parsedDate.format('HH:mm')}.Te aguardamos lá!`);
                    userSession[from] = null; 
                } else {
                    message.reply('Desculpe, o horário solicitado não está disponível. Por favor, escolha outro horário.');
                   
                }
            } else {
                
                message.reply('Desculpe, o formato da data ou horário está incorreto. Por favor, insira no formato "28/10/2024 às 14:00" ou algo como "amanhã às 14:00".');
                
            }
            break;
        default:
            message.reply('Não entendi. Por favor, siga o fluxo de agendamento.');
            break;
    }
});


async function checkAvailability(startDateTime, endDateTime) {
    const auth = new GoogleAuth({
        keyFile: '',  // Arquivo te autenticação do google
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const res = await calendar.events.list({
        calendarId: '', //Email para o qual os agendamentos serão enviados
        timeMin: startDateTime,
        timeMax: endDateTime,
        singleEvents: true,
        orderBy: 'startTime',
    });

    return res.data.items.length === 0;  
}


async function createEvent(name, service, startDateTime, endDateTime) {
    const auth = new GoogleAuth({
        keyFile: '', // Arquivo te autenticação do google
        scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const authClient = await auth.getClient();
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const event = {
        summary: `Agendamento de ${service} para ${name}`,
        location: 'Barbearia Exemplo',
        description: `Serviço: ${service}`,
        start: {
            dateTime: startDateTime,
            timeZone: 'America/Sao_Paulo',
        },
        end: {
            dateTime: endDateTime,
            timeZone: 'America/Sao_Paulo',
        },
        visibility: 'default',
    };

    const response = await calendar.events.insert({
        calendarId: 'danilocardosodemelo@gmail.com', //Email para o qual os agendamentos serão enviados
        resource: event,
    });

}

client.initialize();
