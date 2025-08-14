# Brisamar Weather Station

Brisamar is a hobby weather station that collects data from an Ecowitt device and
publishes live conditions on a small web page.  The project contains a Python
backend that ingests the station's readings and a very simple HTML/JavaScript
frontend that displays the latest values.

## Project Structure

```
.
├── app.js          # Front‑end logic for fetching and rendering data
├── index.html      # Static web page
├── server/
│   └── api_meteo-py  # FastAPI application that receives and serves data
└── styles.css      # Basic styling
```

## Backend

The backend is a FastAPI application that exposes several endpoints:

- `POST /api` – receives measurements sent by the Ecowitt station, logs the raw
  payload, stores the data in a MySQL database and updates `live.json`
- `GET /live` – returns the most recent observation stored in `live.json`
- `GET /latest` – fetches the latest observation directly from the database
- `GET /history?hours=N` – returns a list of observations for the last _N_ hours
- `GET /metar-tgftp/{icao}` – retrieves and caches METAR data from NOAA
- `GET /health` – simple health check endpoint

Database access is performed via a small MySQL connection pool to avoid blocking
the event loop.  Logs are written under `/home/carlos/meteo_logs` by default, and
current conditions are stored in `/var/lib/meteo/live.json`.

### Running the server

1. Install dependencies:

   ```bash
   pip install fastapi "uvicorn[standard]" mysql-connector-python
   ```
2. Start the application:

   ```bash
   uvicorn server.api_meteo-py:app
   ```

The database credentials and log paths are hard‑coded in `api_meteo-py`; adjust
`DB_CONFIG`, `LOG_DIR` and `LIVE_FILE` as needed or move them to environment
variables for production use.

## Frontend

The frontend is a single page (`index.html`) enhanced by `app.js`.  It polls the
backend every few seconds to update the displayed conditions and also fetches a
small history slice for charts.

To serve the frontend you can use any static file server, or simply open
`index.html` in a browser while the backend is running on the same host.

## Development

Run the following checks before committing changes:

```bash
python -m py_compile server/api_meteo-py
node --check app.js
```

These commands validate the Python and JavaScript files for syntax errors.

## License

This project is intended for personal use and does not currently specify a
formal license.  Use at your own risk.

