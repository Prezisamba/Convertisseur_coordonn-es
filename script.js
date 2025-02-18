function reloadPage() {
    location.reload();
}

function dmsToDD(degrees, minutes, seconds, direction) {
    let dd = parseFloat(degrees) + parseFloat(minutes) / 60 + parseFloat(seconds) / 3600;
    if (direction === 'S' || direction === 'W') {
        dd *= -1;
    }
    return dd;
}

function ddToDMS(dd, isLatitude) {
    const absolute = Math.abs(dd);
    const degrees = Math.floor(absolute);
    const minutes = Math.floor((absolute - degrees) * 60);
    const seconds = ((absolute - degrees - minutes / 60) * 3600).toFixed(2);
    const direction = dd >= 0 ? (isLatitude ? 'N' : 'E') : (isLatitude ? 'S' : 'W');
    return `${degrees}°${minutes}'${seconds}"${direction}`;
}

function ddToGrad(dd) {
    return (dd * 10 / 9).toFixed(6);
}

function ddToRad(dd) {
    return (dd * Math.PI / 180).toFixed(6);
}

function geoToCart(lat, lon, h = 0) {
    const φ = (lat * Math.PI) / 180;
    const λ = (lon * Math.PI) / 180;
    const a = 6378137;
    const e2 = 0.00669437999014;
    const N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2);
    const X = (N + h) * Math.cos(φ) * Math.cos(λ);
    const Y = (N + h) * Math.cos(φ) * Math.sin(λ);
    const Z = (N * (1 - e2) + h) * Math.sin(φ);
    return { X, Y, Z };
}

function cartToGeo(X, Y, Z) {
    const a = 6378137;
    const e2 = 0.00669437999014;
    const p = Math.sqrt(X ** 2 + Y ** 2);
    let φ = Math.atan2(Z, p * (1 - e2));
    let N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2);
    let h = p / Math.cos(φ) - N;

    for (let i = 0; i < 5; i++) {
        N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2);
        h = p / Math.cos(φ) - N;
        φ = Math.atan2(Z, p * (1 - e2 * (N / (N + h))));
    }

    const λ = Math.atan2(Y, X);
    return {
        lat: (φ * 180) / Math.PI,
        lon: (λ * 180) / Math.PI,
        h,
    };
}

function handleFileImport() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    const conversionType = document.getElementById('conversionType').value;

    if (!file) {
        document.getElementById('error').textContent = "Veuillez sélectionner un fichier.";
        return;
    }

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
        document.getElementById('error').textContent = "Format de fichier non supporté. Veuillez importer un fichier CSV ou JSON.";
        return;
    }

    const reader = new FileReader();

    reader.onload = function(event) {
        const content = event.target.result;
        let coordinates;

        try {
            if (file.name.endsWith('.csv')) {
                coordinates = parseCSV(content);
            } else if (file.name.endsWith('.json')) {
                coordinates = JSON.parse(content);
            }

            const results = coordinates.map(coord => {
                let converted;
                switch (conversionType) {
                    case 'dms_to_dd':
                        const latParts = coord.latitude.match(/(\d+)[°](\d+)['](\d+\.?\d*)["]([N|S])/);
                        const lonParts = coord.longitude.match(/(\d+)[°](\d+)['](\d+\.?\d*)["]([E|W])/);
                        if (!latParts || !lonParts) {
                            throw new Error("Format DMS invalide.");
                        }
                        converted = {
                            latitudeDD: dmsToDD(latParts[1], latParts[2], latParts[3], latParts[4]),
                            longitudeDD: dmsToDD(lonParts[1], lonParts[2], lonParts[3], lonParts[4]),
                        };
                        break;
                    case 'dd_to_dms':
                        converted = {
                            latitudeDMS: ddToDMS(coord.latitude, true),
                            longitudeDMS: ddToDMS(coord.longitude, false),
                        };
                        break;
                    case 'dd_to_grad':
                        converted = {
                            latitudeGrad: ddToGrad(coord.latitude),
                            longitudeGrad: ddToGrad(coord.longitude),
                        };
                        break;
                    case 'dd_to_rad':
                        converted = {
                            latitudeRad: ddToRad(coord.latitude),
                            longitudeRad: ddToRad(coord.longitude),
                        };
                        break;
                    case 'geo_to_cart':
                        converted = geoToCart(coord.latitude, coord.longitude, coord.altitude || 0);
                        break;
                    case 'cart_to_geo':
                        converted = cartToGeo(coord.X, coord.Y, coord.Z);
                        break;
                    default:
                        throw new Error("Type de conversion non supporté.");
                }
                return { ...coord, ...converted };
            });

            displayResults(results);
        } catch (error) {
            document.getElementById('error').textContent = "Erreur lors de la conversion : " + error.message;
        }
    };

    reader.readAsText(file);
}

function parseCSV(content) {
    const separator = content.includes(';') ? ';' : ',';
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length < 2) {
        throw new Error("Le fichier CSV ne contient pas de données valides.");
    }

    const headers = lines[0].split(separator).map(header => header.trim());
    const coordinates = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(value => value.trim());

        if (values.length !== headers.length) {
            console.warn(`Ligne ignorée (mauvais format) : ${lines[i]}`);
            continue;
        }

        let coord = {};
        headers.forEach((header, index) => {
            let value = values[index];
            if (!isNaN(value) && value.trim() !== "") {
                value = parseFloat(value);
            }
            coord[header] = value;
        });

        coordinates.push(coord);
    }

    return coordinates;
}

function displayResults(results) {
    const outputDiv = document.getElementById('output');
    outputDiv.innerHTML = '';

    if (results.length === 0) {
        outputDiv.innerHTML = "<p>Aucune donnée à afficher.</p>";
        return;
    }

    const table = document.createElement('table');
    table.className = 'table table-bordered';

    const headers = Object.keys(results[0]);
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    results.forEach(result => {
        const row = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = result[header];
            row.appendChild(td);
        });
        table.appendChild(row);
    });

    outputDiv.appendChild(table);
}

function exportResults(format) {
    const outputDiv = document.getElementById('output');
    if (!outputDiv || outputDiv.innerHTML.trim() === '') {
        alert("Aucun résultat à exporter !");
        return;
    }

    let results = [];
    const rows = outputDiv.querySelectorAll('table tr');
    const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.textContent);

    for (let i = 1; i < rows.length; i++) {
        const rowData = {};
        const cells = rows[i].querySelectorAll('td');
        headers.forEach((header, index) => {
            rowData[header] = cells[index].textContent;
        });
        results.push(rowData);
    }

    if (format === 'csv') {
        exportToCSV(results);
    } else if (format === 'json') {
        exportToJSON(results);
    }
}

function exportToCSV(data) {
    let csvContent = "";
    const headers = Object.keys(data[0]).join(",") + "\n";
    csvContent += headers;
    data.forEach(row => {
        csvContent += Object.values(row).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "resultats_conversion.csv";
    link.click();
}

function exportToJSON(data) {
    const jsonContent = JSON.stringify(data, null, 4);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "resultats_conversion.json";
    link.click();
}