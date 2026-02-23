# Схемы работы функций Chaos Organizer

В этом файле описаны потоки данных и взаимодействие компонентов фронтенда. Диаграммы в формате Mermaid можно просматривать в редакторах с поддержкой Mermaid (VS Code, GitHub, GitLab и т.п.) или на [mermaid.live](https://mermaid.live).

---

## 1. Инициализация приложения

При создании экземпляра `ChaosOrganizerApp` применяются настройки, инициализируются компоненты, подключается WebSocket и загружаются сообщения после готовности эмодзи.

```mermaid
sequenceDiagram
    participant User
    participant App as ChaosOrganizerApp
    participant Settings as SettingsService
    participant Emoji as EmojiShortcodeResolver
    participant MM as MessagesManager
    participant WS as WebSocketService
    participant MC as MessageComponent

    User->>App: new ChaosOrganizerApp()
    App->>Settings: apply()
    App->>App: render()
    Note over App: Notification, MessagesManager, Sidebar,<br/>MessageComponent, LazyLoader, SearchBar,<br/>InputPanel, WebSocketService
    App->>WS: connect()
    App->>Emoji: initEmojiShortcodeResolver()
    Emoji-->>App: resolved
    App->>MM: getMessages(PAGE_SIZE, 0)
    MM-->>App: { messages, total, fromCache }
    App->>MC: renderMessages(messages)
    App->>App: lazyLoader.attach(container)
```

---

## 2. Отправка сообщения

Пользователь вводит текст и/или прикрепляет файлы. При нажатии «Отправить» формируется `MessageSendModel`, при включённом шифровании — шифруются текст и файлы. Данные отправляются через API; при ответе бота отображаются оба сообщения.

```mermaid
flowchart LR
    subgraph Input
        A[Поле ввода + вложения]
        B[MessageSendModel.toFormData]
        C{Шифрование?}
        D[EncryptionService]
    end
    subgraph API
        E[MessagesManager.sendMessage]
        F[Api.sendMessage / sendMessageWithProgress]
        G[POST /api/messages]
    end
    subgraph UI
        H[MessageComponent.renderMessage]
        I[Бот: renderMessage для botReply]
    end

    A --> B
    B --> C
    C -->|Да| D
    C -->|Нет| E
    D --> E
    E --> F
    F --> G
    G --> E
    E --> H
    E --> I
```

```mermaid
sequenceDiagram
    participant InputPanel
    participant MessageSendModel
    participant MessagesManager
    participant Api
    participant Backend
    participant MessageComponent

    InputPanel->>MessageSendModel: new MessageSendModel({ content, files, encrypt })
    alt Режим шифрования
        InputPanel->>InputPanel: showPasswordModal()
        InputPanel->>MessageSendModel: encrypt text/files
    end
    InputPanel->>MessagesManager: sendMessage(messageData, { onProgress })
    MessagesManager->>MessageSendModel: toFormData()
    MessagesManager->>Api: sendMessage(formData) или sendMessageWithProgress
    Api->>Backend: POST /api/messages (FormData)
    Backend-->>Api: { message } или { message, botReply }
    Api-->>MessagesManager: response
    MessagesManager->>MessageComponent: renderMessage(message)
    alt Ответ бота
        MessagesManager-->>InputPanel: { message, botReply }
        InputPanel->>MessageComponent: renderMessage(botReply)
    end
```

---

## 3. Загрузка сообщений и ленивая подгрузка

Первая страница запрашивается при старте или при смене категории в сайдбаре. Ленивая подгрузка срабатывает при прокрутке вверх: `LazyMessagesLoader` отслеживает `scrollTop` и запрашивает следующую порцию через `getMessagesByCategory(categoryId, limit, offset)`.

```mermaid
flowchart TB
    subgraph Start
        S1[Старт / смена категории]
    end
    subgraph Load
        S1 --> L1[MessagesManager.getMessages или getMessagesByCategory]
        L1 --> L2[Api.getMessages / searchMessages]
        L2 --> L3[Backend API]
        L3 --> L4[MessageReceiveModel для каждого]
        L4 --> L5[MessageComponent.renderMessages]
        L5 --> L6[LazyMessagesLoader.setState + attach]
    end
    subgraph Scroll
        U[Пользователь крутит вверх]
        U --> C{scrollTop <= threshold?}
        C -->|Да| M[loadMore]
        M --> L1
        L1 --> P[prependMessages]
    end
```

```mermaid
sequenceDiagram
    participant App
    participant MM as MessagesManager
    participant Api
    participant Lazy as LazyMessagesLoader
    participant MC as MessageComponent

    Note over App: loadMessages() или loadMessagesByCategory(id)
    App->>MM: getMessages(10, 0) или getMessagesByCategory(id, 10, 0)
    MM->>Api: getMessages / searchMessages
    Api-->>MM: { messages, total }
    MM-->>App: { messages, total, fromCache }
    App->>Lazy: setState(categoryId, messages.length, total)
    App->>MC: renderMessages(messages)
    App->>Lazy: attach(messagesContainer)

    Note over MC: Пользователь прокручивает вверх
    Lazy->>Lazy: _onScroll(): scrollTop <= threshold
    Lazy->>MM: getMessagesByCategory(categoryId, 10, currentOffset)
    MM-->>Lazy: { messages, total }
    Lazy->>MC: prependMessages(messages)
```

---

## 4. Синхронизация между вкладками (WebSocket)

После подключения к `ws://.../ws` сервер присылает события `new_message`, `message_updated`, `message_deleted`. Обработчики обновляют список сообщений без перезагрузки страницы.

```mermaid
sequenceDiagram
    participant Browser1 as Вкладка 1
    participant Browser2 as Вкладка 2
    participant WS1 as WebSocket (вкладка 1)
    participant WS2 as WebSocket (вкладка 2)
    participant Backend

    Browser1->>Backend: POST /api/messages (отправка)
    Backend->>Backend: сохранить сообщение
    Backend->>WS1: { event: "new_message", payload }
    Backend->>WS2: { event: "new_message", payload }
    WS1->>Browser1: onNewMessage(payload) → renderMessage
    WS2->>Browser2: onNewMessage(payload) → renderMessage
```

```mermaid
flowchart LR
    A[Start] --> B[Connecting]
    B --> C[Open]
    C --> D[onmessage]
    D --> C
    C --> E[Reconnecting]
    E --> B
    C --> F[Close]
```
*Состояния WebSocket: подключение → открыто → по сообщению остаётся открытым; при обрыве — реконнект.*

---

## 5. Поиск по сообщениям

Ввод в поле поиска с debounce вызывает `MessagesManager.searchMessages(query, filters)`. Фильтры (чекбоксы) формируют объект `type` и другие параметры. Результаты показываются в выпадающем блоке; клик по результату прокручивает ленту к сообщению.

```mermaid
flowchart LR
    A[SearchBar: input] --> B[scheduleSearch debounce]
    B --> C[buildFilters из чекбоксов]
    C --> D[MessagesManager.searchMessages]
    D --> E[Api.searchMessages]
    E --> F[GET /api/messages/search?q=...&type=...]
    F --> G[Отображение результатов]
    G --> H[Клик по результату]
    H --> I[MessageComponent.scrollToMessage]
```

---

## 6. Напоминания

Напоминание создаётся либо парсингом команды `@schedule: HH:MM DD.MM.YYYY «Текст»` из поля ввода, либо через модальное окно (кнопка «Напоминание» в бургер-меню). `ReminderService` запрашивает разрешение Notification API, планирует `setTimeout` на время срабатывания и показывает уведомление.

```mermaid
flowchart TB
    subgraph Create
        A["Текст @schedule или модальное окно"]
        B["parseScheduleCommand / ввод даты и текста"]
        B --> C["ReminderService.scheduleReminder"]
        C --> D["requestPermission — Notification API"]
        C --> E["setTimeout showNotification delay"]
    end
    subgraph Trigger
        E --> F["Время срабатывания"]
        F --> G["showNotification + toast"]
    end
```

---

## 7. Экспорт и импорт истории

Экспорт: по кнопке в сайдбаре вызывается `ExportImportService.exportHistory()` → `MessagesManager.exportHistory()` (API возвращает Blob) → скачивание файла через создание `<a download>`. Импорт: выбор файла → `MessagesManager.importHistory(file)` (POST с файлом) → после успеха вызывается `loadMessages()` для обновления списка.

```mermaid
sequenceDiagram
    participant Sidebar
    participant ExportImport as ExportImportService
    participant MM as MessagesManager
    participant Api
    participant App

    Note over Sidebar: Экспорт
    Sidebar->>ExportImport: exportHistory()
    ExportImport->>MM: exportHistory()
    MM->>Api: exportHistory()
    Api->>Api: GET /api/messages/export → Blob
    Api-->>ExportImport: blob
    ExportImport->>ExportImport: downloadBlobAsFile(blob)

    Note over Sidebar: Импорт
    Sidebar->>ExportImport: importHistory()
    ExportImport->>ExportImport: chooseImportFile()
    ExportImport->>MM: importHistory(file)
    MM->>Api: importHistory(file)
    Api->>Api: POST /api/messages/import (FormData)
    ExportImport->>App: loadMessages()
```

---

## 8. Закрепление и избранное

Закрепление: вызов `MessagesManager.pinMessage(id, true)` → API обновляет сообщение → WebSocket рассылает `message_updated`; на фронте `MessageComponent.updateMessageInList` обновляет элемент, `PinnedMessageHandler` выносит закреплённое в блок сверху. Избранное: `MessagesManager.favoriteMessage(id, true)` — аналогично через API и при необходимости через WebSocket/обновление списка.

```mermaid
flowchart LR
    subgraph Pin
        P1[Меню сообщения: Закрепить]
        P2[MessagesManager.pinMessage]
        P3[Api.pinMessage]
        P4[Backend + WebSocket message_updated]
        P5[PinnedMessageHandler + updateMessageInList]
        P1 --> P2 --> P3 --> P4 --> P5
    end
    subgraph Favorite
        F1[Меню сообщения: В избранное]
        F2[MessagesManager.favoriteMessage]
        F3[Api.favoriteMessage]
        F1 --> F2 --> F3
    end
```

---

## Основные компоненты и сервисы

| Компонент / сервис | Назначение |
|-------------------|------------|
| `ChaosOrganizerApp` | Точка входа, инициализация и связка всех модулей |
| `MessagesManager` | Работа с API: получение, отправка, удаление, поиск, категории, pin/favorite, экспорт/импорт |
| `ApiService` | HTTP-запросы к бэкенду (fetch), формирование URL и заголовков |
| `WebSocketService` | Подключение к `/ws`, обработка событий new_message, message_updated, message_deleted, реконнект |
| `LazyMessagesLoader` | Обработчик скролла, подгрузка следующей страницы при прокрутке вверх |
| `MessageComponent` | Отрисовка списка сообщений, превью вложений, действия (pin, избранное, удалить, скачать, расшифровать) |
| `InputPanel` | Поле ввода, вложения, бургер-меню (файл, аудио, видео, гео, напоминание, шифрование), палитра команд @ |
| `SearchBar` | Поле поиска, фильтры по типу, debounce, отображение результатов и переход к сообщению |
| `Sidebar` | Категории, экспорт/импорт, настройки, документация |
| `ReminderService` | Парсинг @schedule, планирование уведомлений (setTimeout), Notification API |
| `ExportImportService` | Вызов API экспорта/импорта, выбор файла, скачивание Blob |

---

*Файл создан для проекта Chaos Organizer. Схемы соответствуют коду фронтенда в `chaos-organizer-frontend/src`.*
