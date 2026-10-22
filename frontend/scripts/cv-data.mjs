// Данные резюме для scripts/cv.mjs: EN и RU в одной структуре. Единственный источник — то, что здесь;
// телефон, дата рождения, адрес, гражданство и прочие личные данные не включаются намеренно.

const contacts = [
  { label: 'polezhaev.yasha@gmail.com', href: 'mailto:polezhaev.yasha@gmail.com' },
  { label: 'Telegram @poll_ezha', href: 'https://t.me/poll_ezha' },
  { label: 'github.com/pollezha', href: 'https://github.com/pollezha' },
]

const skills = [
  'C#',
  '.NET',
  'ASP.NET Core',
  'EF Core',
  'PostgreSQL',
  'SQL Server',
  'MongoDB',
  'Redis',
  'RabbitMQ',
  'Kafka',
  'SignalR',
  'Quartz.NET',
  'Docker',
  'Kubernetes',
  'Azure',
  'S3',
  'Git',
  'GitLab CI/CD',
  'REST API',
  'DDD',
  'Clean Architecture',
  'Microservices',
  'Grafana',
  'Vue.js',
  'Claude Code',
]

const prospaceStack =
  'C#, .NET, ASP.NET Core, EF Core, PostgreSQL, MongoDB, Kafka, SignalR, S3, Azure, Kubernetes, Docker, Grafana, Vue.js'
const timepathStack =
  'C#, ASP.NET Core, EF Core, PostgreSQL, SQL Server, RabbitMQ, SignalR, Docker, GitLab CI'

export const en = {
  lang: 'en',
  file: 'Yakov_Polezhaev_CV_EN.pdf',
  name: 'Yakov Polezhaev',
  role: 'Backend Software Engineer (.NET / C#)',
  contacts,
  location: 'Based in Serbia · Remote or relocation in Europe',
  labels: {
    summary: 'Summary',
    skills: 'Skills',
    experience: 'Experience',
    education: 'Education',
    courses: 'Courses',
    languages: 'Languages',
    stack: 'Stack',
  },
  summary:
    'Backend engineer with 2+ years of commercial experience building enterprise and microservices-based applications in C# / .NET. Designs business-critical modules, improves performance, follows DDD and Clean Architecture. Contributed to a Transportation Management System processing 1,000+ shipments per day across 25 microservices. Builds with AI agents (Claude Code) daily.',
  skills,
  experience: [
    {
      title: 'Backend Developer (.NET)',
      company: 'ProSpace (Smart-com)',
      place: 'Moscow / remote',
      period: 'Jan 2026 – present',
      intro:
        'TMS platform for freight (1,000+ shipments daily, 25 microservices, PostgreSQL 200+ tables).',
      bullets: [
        'Built the Transport module on my own — the core service every shipment passes through (ASP.NET Core REST), implementing the transport domain logic with maintainability and extensibility in mind.',
        'Designed event-driven CRUD audit logging extensible without touching business logic, with minimal performance impact and lower regression risk.',
        'Took part in architecture of new modules, clarified specs with analysts, owned technical decisions in my scope.',
        'Used Grafana to diagnose services, find incident root causes and verify releases.',
        'Refactored legacy code, worked in a cross-functional team (backend, frontend, QA, analysts), code review, xUnit tests.',
      ],
      stack: prospaceStack,
      link: { label: 'prospace.tech/optitrack', href: 'https://prospace.tech/optitrack' },
    },
    {
      title: 'Backend Developer (.NET)',
      company: 'TimePath (Траектория времени)',
      place: '',
      period: 'Jul 2024 – Dec 2025',
      intro:
        'Enterprise platforms for energy and utilities; the largest project served 17 regions, 7M+ objects and 2,000+ users.',
      bullets: [
        'Developed REST backend services on C# / ASP.NET Core; PostgreSQL and SQL Server; RabbitMQ and SignalR.',
        'Cut a complex filter page from 40+ s to under 2 s: found that data was filtered on the client after loading the full set; optimised SQL and moved processing to the database.',
        'Moved queues, file handling and shared logic into a platform core — new features ~2× faster to build, verified on three projects.',
        'Implemented security: endpoint protection, role-based access, configuration encryption, bulk-export limits.',
        "Set up a demo stand for client offers; configured GitLab CI; reviewed interns' code; wrote unit tests.",
      ],
      stack: timepathStack,
      link: { label: 'timepath.ru', href: 'https://timepath.ru' },
    },
  ],
  education: [
    {
      degree: "Bachelor's degree in Business Informatics",
      school: 'HSE University, Perm campus',
      year: '2025',
    },
  ],
  courses: [
    { year: '2024', text: 'Python testing course, ITFB Academy' },
    { year: '2023', text: 'Teachers’ school, Liga Robotov (robotics instructor)' },
  ],
  languages: [
    { name: 'Russian', level: 'native' },
    { name: 'English', level: 'B2' },
    { name: 'Czech', level: 'B2' },
    { name: 'German', level: 'A2' },
  ],
}

export const ru = {
  lang: 'ru',
  file: 'Yakov_Polezhaev_CV_RU.pdf',
  name: 'Полежаев Яков',
  role: 'Backend-разработчик (.NET / C#)',
  contacts,
  location: 'Сербия · удалённо или релокация в Европу',
  labels: {
    summary: 'О себе',
    skills: 'Навыки',
    experience: 'Опыт работы',
    education: 'Образование',
    courses: 'Курсы',
    languages: 'Языки',
    stack: 'Стек',
  },
  summary:
    'Backend-разработчик с опытом коммерческой разработки 2+ года: enterprise-приложения и микросервисы на C# / .NET. Проектирую бизнес-критичные модули, улучшаю производительность, следую DDD и Clean Architecture. Участвовал в разработке TMS, обрабатывающей 1000+ перевозок в день на 25 микросервисах. Ежедневно работаю с AI-агентами (Claude Code).',
  skills,
  experience: [
    {
      title: 'Backend Developer (.NET)',
      company: 'ProSpace (Смарт-ком)',
      place: 'Москва / удалённо',
      period: 'январь 2026 — настоящее время',
      intro:
        'TMS-платформа для грузоперевозок (1000+ перевозок в день, 25 микросервисов, PostgreSQL 200+ таблиц).',
      bullets: [
        'Самостоятельно разработал транспортный модуль — ключевой сервис, через который проходит каждая перевозка (ASP.NET Core REST), реализовав доменную логику транспорта с расчётом на поддерживаемость и расширяемость.',
        'Спроектировал event-driven журналирование CRUD-операций, расширяемое без изменения бизнес-логики, с минимальным влиянием на производительность и меньшим риском регрессий.',
        'Участвовал в проектировании новых модулей, уточнял требования с аналитиками, самостоятельно принимал технические решения в своей зоне ответственности.',
        'Использовал Grafana для диагностики сервисов, поиска причин инцидентов и проверки релизов.',
        'Рефакторинг легаси-кода, работа в кросс-функциональной команде (backend, frontend, QA, аналитики), Code Review, Unit-тесты (xUnit).',
      ],
      stack: prospaceStack,
      link: { label: 'prospace.tech/optitrack', href: 'https://prospace.tech/optitrack' },
    },
    {
      title: 'Backend Developer (.NET)',
      company: 'Траектория времени (TimePath)',
      place: '',
      period: 'июль 2024 — декабрь 2025',
      intro:
        'Enterprise-платформы для энергетики и ЖКХ; крупнейший проект обслуживал 17 регионов, 7 млн объектов и 2000+ пользователей.',
      bullets: [
        'Разрабатывал REST-сервисы на C# / ASP.NET Core; PostgreSQL и SQL Server; RabbitMQ и SignalR.',
        'Ускорил сложную страницу с фильтрацией с 40+ с до менее 2 с: выяснил, что данные фильтровались на клиенте после загрузки полного набора; оптимизировал SQL и перенёс обработку в БД.',
        'Вынес очереди, работу с файлами и общую логику в платформенное ядро — новые фичи стали делаться примерно вдвое быстрее, проверено на трёх проектах.',
        'Реализовал безопасность: защита эндпоинтов, ролевая модель, шифрование конфигурации, ограничение массовой выгрузки.',
        'Поднял демо-стенд для предложений клиентам; настроил GitLab CI; проводил ревью кода стажёров; писал Unit-тесты.',
      ],
      stack: timepathStack,
      link: { label: 'timepath.ru', href: 'https://timepath.ru' },
    },
  ],
  education: [{ degree: 'Бакалавр, Бизнес-информатика', school: 'НИУ ВШЭ, Пермь', year: '2025' }],
  courses: [
    { year: '2024', text: 'Курсы тестирования на Python, ITFB Academy' },
    { year: '2023', text: 'Школа преподавателей, Лига роботов' },
  ],
  languages: [
    { name: 'Русский', level: 'родной' },
    { name: 'Английский', level: 'B2' },
    { name: 'Чешский', level: 'B2' },
    { name: 'Немецкий', level: 'A2' },
  ],
}

export const cvs = [en, ru]
