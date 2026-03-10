const path = require('path');
const winston = require('winston');

const createLogger = () => {
    const customColors = {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        http: 'magenta',
        verbose: 'cyan',
        debug: 'blue',
        silly: 'gray'
    };

    const customFormat = winston.format.printf(({ level, message, timestamp }) => `${timestamp} [${level.toUpperCase()}]: ${message}`);

    const getTimestampWithTimezone = () => {
        const date = new Date();
        const options = {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        return new Intl.DateTimeFormat('pt-BR', options).format(date).replace(',', '');
    };

    const logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'http',
        format: winston.format.combine(
            winston.format.timestamp({ format: getTimestampWithTimezone }),
            winston.format.errors({ stack: true }),
            customFormat,
            winston.format.colorize({ all: true, colors: customColors })
        ),
        transports: [
            new winston.transports.Console()
        ]
    });

    const logWithFile = level => (message, logFile) => {
        if (logFile) {
            const transport = new winston.transports.File({ filename: path.resolve(__dirname, `./logs/${logFile || 'APISITE'}.log`) });
            logger.add(transport);
            logger.log(level, message);
            logger.remove(transport);
        } else {
            logger.log(level, message);
        }
    };

    return {
        error: logWithFile('error'),
        warn: logWithFile('warn'),
        info: logWithFile('info'),
        http: logWithFile('http'),
        verbose: logWithFile('verbose'),
        debug: logWithFile('debug'),
        silly: logWithFile('silly')
    };
};

const logger = createLogger();

module.exports = logger;