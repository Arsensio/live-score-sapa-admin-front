# Touchline — администрирование live-score

React + TypeScript + React Router + Vite. Mobile-first: турниры, команды с игроками, группы и жеребьевка. Данные получаются с backend; демоданных и localStorage нет.

## Запуск

Node.js 22.12+; проверено на Node.js 24.

```powershell
npm.cmd install
Copy-Item .env.example .env
# Укажите адрес backend в .env
npm.cmd run dev
```

```dotenv
VITE_API_BASE_URL=http://localhost:8093
VITE_GOOGLE_CLIENT_ID=<Google OAuth Client ID>
```

Задайте `VITE_API_BASE_URL` как origin User Service/Gateway без `/api`: пути API уже включают этот префикс. `VITE_GOOGLE_CLIENT_ID` — публичный OAuth Client ID из Google Cloud; Google Client Secret нельзя помещать во frontend. В dev используйте `.env`; файлы `.env` исключены из git. В Docker production обе переменные задаются в окружении контейнера при запуске, без пересборки image.

В режиме `npm.cmd run dev` Vite proxy направляет запросы `/api` и `/image` на `VITE_API_BASE_URL`.

В production `VITE_API_BASE_URL` и `VITE_GOOGLE_CLIENT_ID` задаются в окружении контейнера. Runtime-конфиг генерируется Nginx при старте, поэтому адрес Gateway и Client ID можно менять без пересборки image. Backend должен разрешать credentials для origin фронтенда.

## Архитектура

- `src/app` — запуск, React Router, каркас и общие стили.
- `src/pages/<page>` — UI, формы, схемы и специфичные операции страниц.
- `src/entities/tournament`, `team`, `group` — общие сущности, типы, статусы и запросы.
- `src/shared/api` — единый HTTP-клиент, ошибки, пагинация, отмена запросов.
- `src/shared/config/backend.ts` — адрес API из `VITE_API_BASE_URL`.
- `src/shared/ui` — общие формы, статусы, загрузка, ошибки и confirmation dialog.
- `src/shared/lib` — общая валидация.
- `tests` — проверки HTTP-инфраструктуры, форм и пользовательских сценариев.

Зависимости: `app → pages → entities → shared`. Страницы не импортируют друг друга. `city`, `graduate`, `dictionary` из примера не относятся к турнирам и не добавлены.

## Маршруты

| URL                                | Экран                    |
| ---------------------------------- | ------------------------ |
| `/tournaments`                     | Поиск, список, пагинация |
| `/tournaments/new`                 | Создание турнира         |
| `/tournaments/:id/edit`            | Редактирование           |
| `/tournaments/:id/teams`           | Команды                  |
| `/tournaments/:id/teams/new`       | Команда с игроками       |
| `/tournaments/:id/groups`          | Группы, фильтр, сброс    |
| `/tournaments/:id/groups/:groupId` | Команды группы           |
| `/tournaments/:id/draw`            | Жеребьевка               |

На production сервер отдаёт `index.html` для клиентских маршрутов. `/api/*` обрабатывает backend, а не SPA fallback.

## API и допущения

Вкладка «Голосование за игрока» находится внутри турнира рядом со статистикой игроков и открывает `/tournaments/:tournamentId/player-award-polls/new`. После создания открывается `/tournaments/:tournamentId/player-award-polls/:pollId`; эту ссылку можно сохранить для последующего управления. API списка всех голосований отсутствует. Футболисты запрашиваются с query-параметром `tournamentId` текущего турнира.

Футболисты загружаются постранично через `GET /api/players`; выбор сохраняется по ID при поиске и смене страниц. Открытое голосование обновляется каждые 10 секунд только в видимой вкладке. Закрытие требует подтверждения и останавливает автообновление после загрузки окончательных результатов.

Для работы требуется обновлённый gateway с точными маршрутами POST `/api/player-award-polls`, GET `/api/player-award-polls/{pollId}`, PATCH `/api/player-award-polls/{pollId}/action` и GET `/api/player-award-polls/{pollId}/results`. Универсальный маршрут `/api/player-award-polls/**` не используется: `/ballot` сохраняет подстановку userId из токена.

Реализованы все endpoints из ТЗ: `GET/POST /api/tournaments`, `GET/POST /api/teams`, `GET /api/groups/filter`, `POST /api/draw/teams`, `DELETE /api/draw/groups/{groupId}/teams`, `GET /api/teams/admin/groups/{groupId}`.

**Нужно подтвердить:** для просмотра и редактирования предполагаются `GET /api/tournaments/{id}` и `PUT /api/tournaments/{id}`. Они отсутствуют в ТЗ. Меняются в `src/entities/tournament/api.ts`.

Создание турнира должно вернуть объект с `id`. Одиночный турнир: поля запроса, `id`, `status`. Группа: `{ id, name, status }`. Команда: `{ id, name, shortName, logoUrl, players? }`. Обёртка `{ data: ... }` не предполагается.

Списки поддерживают массив, Spring Page (`content`, `totalPages`, `totalElements`, `number`, `last`) и Spring PagedModel (`content`, `page`). Нумерация страниц — с 0. Команды и группы загружаются со всех страниц, чтобы жеребьевка не ограничивалась первой страницей.

Создание групп не описано в ТЗ: группы должны существовать на backend. Вкладка «Жеребьевка» показывает карточки групп с названиями, статусами и составами. Маршрут `/tournaments/:id/draw/:groupId` открывает конкретную группу: здесь свободные команды отмечаются галочками и добавляются одним запросом. Отправляются только выбранные команды с `groupId` открытой группы; распределять весь турнир за один раз не требуется. Поиск не сбрасывает выбор.

Во вкладке «Жеребьевка» составы берутся из `teams` ответа `GET /api/groups/filter`; отдельные запросы `/api/teams/admin/groups/{groupId}` не выполняются. Группы и этапы плей-офф сортируются по `groupOrder`. Все команды турнира загружаются через `/api/teams`, а свободные определяются исключением команд из незавершённых групп. Команды групп FINISHED доступны для следующего этапа, если не входят в другую незавершённую группу. Исторический состав завершённых групп сохраняется. После добавления или сброса снова загружается `/api/groups/filter`. Группы `CREATED` и `IN_PROGRESS` можно дополнять; `FINISHED` доступна только для просмотра. Внутри группы доступен сброс с подтверждением. Backend проверяет конфликты и остаётся источником статусов.

После жеребьевки перечитываются группы и составы. Сброс требует подтверждения и затрагивает только выбранную группу; `FINISHED` заблокирована.

## Группы со статистикой

Вкладка «Группы» использует `GET /api/groups?tournamentId=...` и тип `GroupWithStatistics`. Карточки отображают команды из `teams` с полями `teamName`, `teamLogoUrl`, очками, играми, победами, ничьими, поражениями и голами. Порядок групп задаёт `groupOrder`, статус фильтруется локально. Во вкладке «Группы» кнопка «Завершить группу» вызывает PATCH /api/groups/{groupId}/finish без тела, затем статистика перечитывается через /api/groups. Для FINISHED действие заблокировано. Сброс остаётся во вкладке «Жеребьевка». `/api/groups/filter` возвращает тот же формат команд со статистикой: для отображения используются `teamName`, `teamShortName`, `teamLogoUrl`, а для исключения распределённых команд — `teamId`, не `groupTeamId`.

## Создание и редактирование команды

Оба режима используют `src/pages/team-form/TeamFormPage` (компонент экспортируется из `ui.tsx`):

- `/tournaments/:id/teams/new` — пустая форма, `POST /api/teams`.
- `/tournaments/:id/teams/:teamId/edit` — загрузка через `GET /api/teams/{teamId}` и сохранение через `PUT /api/teams/{teamId}`.

Кнопка редактирования находится в карточке команды. GET должен вернуть полный массив `players`; при его отсутствии сохранение недоступно. Каждый PUT передаёт весь текущий состав, в том числе пустой массив после удаления всех игроков. Backend заменяет состав целиком; отдельных запросов к игрокам нет. `id`, `teamId`, даты и ключи формы в `players` запроса не включаются.

Имя и фамилия обязательны, максимум по 100 символов. Короткое название — максимум 50 символов. Номер футболки необязателен; если заполнен, должен быть целым положительным числом. Пустые необязательные поля отправляются как `null`. Полные URL изображений из ответа преобразуются в `/image/...` для повторного сохранения. Если сохранение завершается ошибкой, введённые данные остаются в форме.

## Изображения

Логотипы и фото выбираются с устройства в формах турнира и команды. Сразу после выбора файл отправляется через единый API-клиент как `FormData` с полем `file`:

- `POST /image/tournament` — логотип турнира.
- `POST /image/team` — логотип команды.
- `POST /image/player` — фото игрока.

Ответ backend: `{ "suffix": "/image/team/uuid.jpg", "url": "http://localhost:8091/image/team/uuid.jpg" }`. В `logoUrl` / `photoUrl` сохраняется `suffix`; для отображения используется текущий backend. Заголовок Content-Type для FormData устанавливает браузер вместе с boundary. Поля JSON остальных запросов не меняются.

Есть предпросмотр, замена, отмена и повтор загрузки. Сохранение формы блокируется до окончания загрузок; после ошибки нужно повторить или отменить загрузку. Удаление карточки игрока отменяет его незавершённый запрос. «Убрать изображение» очищает поле формы; файл на сервере не удаляется, так как endpoint удаления не предоставлен.

## Проверки

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Тесты подменяют API и не меняют настоящий backend. Проверяются запросы создания турнира и команды, валидация и пользовательские сценарии.

## Docker image в GHCR

Сборка и публикация запускаются автоматически при push в `main`. Для ручного запуска откройте **Actions → Build and push frontend image → Run workflow**. Workflow публикует `ghcr.io/arsensio/live-score-frontend` с тегами `latest` и коротким Git commit SHA.

Для входа через Google задайте публичный `VITE_GOOGLE_CLIENT_ID`. Приложение принимает только пользователей с ролью `ADMIN`; роль определяется backend, а не выбирается в интерфейсе. В Kubernetes задайте `VITE_API_BASE_URL` и `VITE_GOOGLE_CLIENT_ID` в `env` контейнера Deployment.
