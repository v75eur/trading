// Fichier central des traductions pour tout le site
const translations = {
    fr: {
        title: "📊 Rick Trading",
        subtitle: "Plateforme professionnelle d'analyse de marché, signaux en temps réel et communauté active",
        launch: "🚀 Accéder à la plateforme",
        feature1: "Signaux live",
        feature2: "Notifications APK",
        feature3: "Chat communautaire",
        footer: "© 2025 Rick Trading - Le trading comporte des risques",
        app_title: "Rick Trading",
        price: "Prix",
        canal: "Canal",
        sr: "S/R",
        signals: "Signaux",
        stats: "Stats",
        chat_title: "💬 Chat Live",
        chat_placeholder: "Votre message...",
        chat_send: "ENVOYER",
        online: "en ligne",
        likes: "j'aime"
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
        chat_title: "💬 Live Chat",
        chat_placeholder: "Your message...",
        chat_send: "SEND",
        online: "online",
        likes: "likes"
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
        chat_title: "💬 Chat en vivo",
        chat_placeholder: "Tu mensaje...",
        chat_send: "ENVIAR",
        online: "en línea",
        likes: "me gusta"
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
        chat_title: "💬 Chat ao vivo",
        chat_placeholder: "Sua mensagem...",
        chat_send: "ENVIAR",
        online: "online",
        likes: "curtidas"
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
        chat_title: "💬 Чат",
        chat_placeholder: "Ваше сообщение...",
        chat_send: "ОТПРАВИТЬ",
        online: "онлайн",
        likes: "лайков"
    },
    it: {
        title: "📊 Rick Trading",
        subtitle: "Piattaforma professionale di analisi di mercato, segnali in tempo reale e community attiva",
        launch: "🚀 Accedi alla piattaforma",
        feature1: "Segnali live",
        feature2: "Notifiche APK",
        feature3: "Chat community",
        footer: "© 2025 Rick Trading - Il trading comporta rischi",
        app_title: "Rick Trading",
        price: "Prezzo",
        canal: "Canale",
        sr: "S/R",
        signals: "Segnali",
        stats: "Statistiche",
        chat_title: "💬 Chat Live",
        chat_placeholder: "Il tuo messaggio...",
        chat_send: "INVIA",
        online: "online",
        likes: "mi piace"
    },
    de: {
        title: "📊 Rick Trading",
        subtitle: "Professionelle Marktanalyseplattform, Echtzeitsignale und aktive Community",
        launch: "🚀 Zur Plattform",
        feature1: "Live-Signale",
        feature2: "APK-Benachrichtigungen",
        feature3: "Community-Chat",
        footer: "© 2025 Rick Trading - Handel ist riskant",
        app_title: "Rick Trading",
        price: "Preis",
        canal: "Kanal",
        sr: "U/S",
        signals: "Signale",
        stats: "Statistiken",
        chat_title: "💬 Live-Chat",
        chat_placeholder: "Deine Nachricht...",
        chat_send: "SENDEN",
        online: "online",
        likes: "Gefällt mir"
    },
    zh: {
        title: "📊 Rick Trading",
        subtitle: "专业市场分析平台，实时信号和活跃社区",
        launch: "🚀 访问平台",
        feature1: "实时信号",
        feature2: "APK通知",
        feature3: "社区聊天",
        footer: "© 2025 Rick Trading - 交易涉及风险",
        app_title: "Rick Trading",
        price: "价格",
        canal: "通道",
        sr: "支撑/阻力",
        signals: "信号",
        stats: "统计",
        chat_title: "💬 聊天室",
        chat_placeholder: "您的消息...",
        chat_send: "发送",
        online: "在线",
        likes: "点赞"
    },
    ja: {
        title: "📊 Rick Trading",
        subtitle: "プロフェッショナルな市場分析プラットフォーム、リアルタイムシグナルと活発なコミュニティ",
        launch: "🚀 プラットフォームへ",
        feature1: "ライブシグナル",
        feature2: "APK通知",
        feature3: "コミュニティチャット",
        footer: "© 2025 Rick Trading - 取引にはリスクが伴います",
        app_title: "Rick Trading",
        price: "価格",
        canal: "チャネル",
        sr: "サポート/レジスタンス",
        signals: "シグナル",
        stats: "統計",
        chat_title: "💬 ライブチャット",
        chat_placeholder: "メッセージ...",
        chat_send: "送信",
        online: "オンライン",
        likes: "いいね"
    }
};

function getCurrentLanguage() {
    let lang = localStorage.getItem('rick_lang');
    if (!lang || !translations[lang]) {
        lang = 'fr';
        localStorage.setItem('rick_lang', lang);
    }
    return lang;
}

function setLanguage(lang) {
    if (translations[lang]) {
        localStorage.setItem('rick_lang', lang);
        location.reload();
    }
}

function t(key) {
    const lang = getCurrentLanguage();
    return translations[lang][key] || translations['fr'][key] || key;
}
