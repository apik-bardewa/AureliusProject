This repository does not include the following files:

- `node-backend/database.db`
- `wiki_index.faiss`

These files are excluded from Git because they are large/generated files.

After cloning this repository, please obtain these files separately and place them in the following locations:

- Add the database file inside the `node-backend` directory;(eg: Aurelius/node=backend/database.db)
- Add the  .faiss file inside the main project directory (eg: Aurelius/wiki_index.faiss


  For Executing the project:
  write the following command in terminal (Ayrelius/FrontendUpdated)
      -npm run dev
  write the following command in termina (Aurelius/node-backend)
       -nodemon server.js
  write the following command in terminal (Aurelius/python_ml_services)
       - uvicorn main:app
