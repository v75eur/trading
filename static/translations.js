// Fichier central des traductions pour tout le site
const translations = {
    fr: {
        // Landing
        title: "📊 Rick Trading",
        subtitle: "Plateforme professionnelle d'analyse de marché, signaux en temps réel et communauté active",
        launch: "🚀 Accéder à la plateforme",
        feature1: "Signaux live",
        feature2: "Notifications APK",
        feature3: "Chat communautaire",
        footer: "© 2025 Rick Trading - Le trading comporte des risques",
        // Trading App
        app_title: "Rick Trading",
        price: "Prix",
        canal: "Canal",
        sr: "S/R",
        signals: "Signaux",
        stats: "Stats",
        canal_haussier: "HAUSSIER",
        canal_baissier: "BAISSIER",
        canal_neutre: "NEUTRE",
        chat_title: "💬 Chat Live",
        chat_placeholder: "Votre message...",
        chat_send: "ENVOYER",
        chat_welcome: "👋 Bienvenue !",
        chat_pseudo: "Choisissez un pseudo pour chatter",
        chat_join: "Rejoindre le chat",
        like_count: "J'aime",
        online: "en ligne",
        admin_title: "Administration",
        admin_pass: "Mot de passe",
        admin_access: "Accéder",
        admin_wrong: "Mot de passe incorrect"
    },
    en: {
        title: "📊 Rick Trading",
        subtitle: "Professional market analysis platform, real-time signals and active community",
        launch: "🚀 Access the platform",
        feature1: "Live signals",
        feature2: "APK notifications",
        feature3: "Community chat",
        footer: "© 2025 Rick Trading - Trading involves risks",
        app_title: "Rick Trading",
        price: "Price",
        canal: "Channel",
        sr: "S/R",
        signals: "Signals",
        stats: "Stats",
        canal_haussier: "BULLISH",
        canal_baissier: "BEARISH",
        canal_neutre: "NEUTRAL",
        chat_title: "💬 Live Chat",
        chat_placeholder: "Your message...",
        chat_send: "SEND",
        chat_welcome: "👋 Welcome!",
        chat_pseudo: "Choose a nickname to chat",
        chat_join: "Join the chat",
        like_count: "Likes",
        online: "online",
        admin_title: "Administration",
        admin_pass: "Password",
        admin_access: "Access",
        admin_wrong: "Wrong password"
    },
    es: {
        title: "📊 Rick Trading",
        subtitle: "Plataforma profesional de análisis de mercado, señales en tiempo real y comunidad activa",
        launch: "🚀 Acceder a la plataforma",
        feature1: "Señales en vivo",
        feature2: "Notificaciones APK",
        feature3: "Chat comunitario",
        footer: "© 2025 Rick Trading - El trading implica riesgos",
        app_title: "Rick Trading",
        price: "Precio",
        canal: "Canal",
        sr: "S/R",
        signals: "Señales",
        stats: "Estadísticas",
        canal_haussier: "ALCISTA",
        canal_baissier: "BAJISTA",
        canal_neutre: "NEUTRO",
        chat_title: "💬 Chat en vivo",
        chat_placeholder: "Tu mensaje...",
        chat_send: "ENVIAR",
        chat_welcome: "👋 ¡Bienvenido!",
        chat_pseudo: "Elige un apodo",
        chat_join: "Unirse al chat",
        like_count: "Me gusta",
        online: "en línea",
        admin_title: "Administración",
        admin_pass: "Contraseña",
        admin_access: "Acceder",
        admin_wrong: "Contraseña incorrecta"
    },
    pt: {
        title: "📊 Rick Trading",
        subtitle: "Plataforma profissional de análise de mercado, sinais em tempo real e comunidade ativa",
        launch: "🚀 Acessar plataforma",
        feature1: "Sinais ao vivo",
        feature2: "Notificações APK",
        feature3: "Chat comunitário",
        footer: "© 2025 Rick Trading - Negociação envolve riscos",
        app_title: "Rick Trading",
        price: "Preço",
        canal: "Canal",
        sr: "S/R",
        signals: "Sinais",
        stats: "Estatísticas",
        canal_haussier: "ALTA",
        canal_baissier: "BAIXA",
        canal_neutre: "NEUTRO",
        chat_title: "💬 Chat ao vivo",
        chat_placeholder: "Sua mensagem...",
        chat_send: "ENVIAR",
        chat_welcome: "👋 Bem-vindo!",
        chat_pseudo: "Escolha um apelido",
        chat_join: "Entrar no chat",
        like_count: "Curtidas",
        online: "online",
        admin_title: "Administração",
        admin_pass: "Senha",
        admin_access: "Acessar",
        admin_wrong: "Senha incorreta"
    },
    ru: {
        title: "📊 Rick Trading",
        subtitle: "Профессиональная платформа для анализа рынка, сигналы в реальном времени и активное сообщество",
        launch: "🚀 Перейти на платформу",
        feature1: "Живые сигналы",
        feature2: "APK уведомления",
        feature3: "Чат сообщества",
        footer: "© 2025 Rick Trading - Торговля сопряжена с рисками",
        app_title: "Rick Trading",
        price: "Цена",
        canal: "Канал",
        sr: "Уровни",
        signals: "Сигналы",
        stats: "Статистика",
        canal_haussier: "ВОСХОДЯЩИЙ",
        canal_baissier: "НИСХОДЯЩИЙ",
        canal_neutre: "НЕЙТРАЛЬНЫЙ",
        chat_title: "💬 Чат",
        chat_placeholder: "Ваше сообщение...",
        chat_send: "ОТПРАВИТЬ",
        chat_welcome: "👋 Добро пожаловать!",
        chat_pseudo: "Выберите никнейм",
        chat_join: "Присоединиться",
        like_count: "Лайки",
        online: "онлайн",
        admin_title: "Администрирование",
        admin_pass: "Пароль",
        admin_access: "Войти",
        admin_wrong: "Неверный пароль"
    }
};

// Fonction pour obtenir la langue actuelle
function getCurrentLanguage() {
    let lang = localStorage.getItem('rick_lang');
    if (!lang || !translations[lang]) {
        lang = 'fr';
        localStorage.setItem('rick_lang', lang);
    }
    return lang;
}

// Fonction pour changer la langue
function setLanguage(lang) {
    if (translations[lang]) {
        localStorage.setItem('rick_lang', lang);
        location.reload(); // Recharge la page pour appliquer toutes les traductions
    }
}

// Fonction pour obtenir une traduction
function t(key) {
    const lang = getCurrentLanguage();
    return translations[lang][key] || translations['fr'][key] || key;
}
