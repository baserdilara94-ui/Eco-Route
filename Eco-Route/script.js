// --- UI Elements ---
const inputs = {
    carsSlider: document.getElementById('carsSlider'),
    carsNum: document.getElementById('carsInput'),
    heavySlider: document.getElementById('heavySlider'),
    heavyNum: document.getElementById('heavyInput'),
    evSlider: document.getElementById('evSlider'),
    evNum: document.getElementById('evInput'),
    waitSlider: document.getElementById('waitSlider'),
    waitNum: document.getElementById('waitInput'),
    windSlider: document.getElementById('windSlider'),
    windNum: document.getElementById('windInput'),
    greenSlider: document.getElementById('greenSlider'),
    greenNum: document.getElementById('greenInput')
};

const aqiElements = {
    circle: document.getElementById('aqiCircle'),
    value: document.getElementById('aqiValue'),
    status: document.getElementById('aqiStatus')
};

const runBtn = document.getElementById('runBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadCsvBtn');
const tableBody = document.getElementById('historyTableBody');

// --- State and Data ---
let recordedData = []; // Array to hold CSV data
let runCount = 0; // Tracks the number of manual runs

// --- Chart.js Initialization ---
const ctx = document.getElementById('aqiChart').getContext('2d');
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = 'Inter';

const aqiChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Hesaplanan AQI',
            data: [],
            backgroundColor: [],
            borderRadius: 4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                max: 300,
                grid: { color: 'rgba(255, 255, 255, 0.05)' }
            },
            x: {
                grid: { display: false }
            }
        },
        plugins: {
            legend: { display: false }
        }
    }
});

// --- Input Synchronization ---
function syncInputs(slider, numInput) {
    slider.addEventListener('input', () => numInput.value = slider.value);
    numInput.addEventListener('input', () => {
        let val = parseInt(numInput.value) || 0;
        let min = parseInt(numInput.min);
        let max = parseInt(numInput.max);
        if (val < min) val = min;
        if (val > max) val = max;
        slider.value = val;
    });
}

syncInputs(inputs.carsSlider, inputs.carsNum);
syncInputs(inputs.heavySlider, inputs.heavyNum);
syncInputs(inputs.evSlider, inputs.evNum);
syncInputs(inputs.waitSlider, inputs.waitNum);
syncInputs(inputs.windSlider, inputs.windNum);
syncInputs(inputs.greenSlider, inputs.greenNum);

// --- Mathematical Model ---
function calculateAQI() {
    const stdCars = parseInt(inputs.carsNum.value);
    const heavyCars = parseInt(inputs.heavyNum.value);
    const evCars = parseInt(inputs.evNum.value);
    const waitTime = parseInt(inputs.waitNum.value);
    const windSpeed = parseInt(inputs.windNum.value);
    const greenRatio = parseInt(inputs.greenNum.value);

    // 1. Production (PM2.5)
    const movingRatio = (60 - waitTime) / 60;
    const idlingRatio = waitTime / 60;
    
    // PM2.5 Emisyon Katsayıları
    // Standart Araç: 10mg hareketli, 5mg rölanti
    const stdEmission = (stdCars * movingRatio * 10) + (stdCars * idlingRatio * 5);
    
    // Ağır Vasıta: 40mg hareketli, 20mg rölanti (Daha büyük motor/lastik)
    const heavyEmission = (heavyCars * movingRatio * 40) + (heavyCars * idlingRatio * 20);
    
    // Elektrikli Araç: 12mg hareketli (sadece ağır lastik aşınması), 0mg rölanti (egzoz yok)
    const evEmission = (evCars * movingRatio * 12) + (evCars * idlingRatio * 0);
    
    const totalPm25Production = stdEmission + heavyEmission + evEmission;
    const concentrationAdded = totalPm25Production / 1000;

    // 2. Removal (Dispersion & Filtration)
    const windDispersion = (windSpeed / 50) * 0.80; // Max 80% removal
    const treeFiltration = (greenRatio / 100) * 0.20; // Max 20% filtration
    const baseSettling = 0.02; // Gravity settling
    
    const totalRemovalRate = windDispersion + treeFiltration + baseSettling;

    // 3. Equilibrium AQI
    const equilibriumPM25 = concentrationAdded / totalRemovalRate;
    let calculatedAqi = Math.round(equilibriumPM25 * 4);
    
    if (calculatedAqi > 500) calculatedAqi = 500;
    
    return {
        aqi: calculatedAqi,
        std: stdCars,
        heavy: heavyCars,
        ev: evCars,
        wait: waitTime,
        wind: windSpeed,
        green: greenRatio
    };
}

// --- UI Updates ---
function getAqiColor(aqi) {
    if (aqi <= 50) return { color: '#10b981', text: 'İyi' }; 
    if (aqi <= 100) return { color: '#f59e0b', text: 'Orta' }; 
    if (aqi <= 150) return { color: '#f97316', text: 'Hassas' }; 
    if (aqi <= 200) return { color: '#ef4444', text: 'Kötü' }; 
    if (aqi <= 300) return { color: '#8b5cf6', text: 'Çok Kötü' }; 
    return { color: '#7f1d1d', text: 'Tehlikeli' }; 
}

function runSimulation() {
    runCount++;
    const result = calculateAQI();
    const aqiInfo = getAqiColor(result.aqi);

    // 1. Update Top Results Circle
    aqiElements.value.textContent = result.aqi;
    aqiElements.status.textContent = aqiInfo.text;
    aqiElements.circle.style.borderColor = aqiInfo.color;
    aqiElements.circle.style.boxShadow = `0 0 20px ${aqiInfo.color}40`;

    // 2. Add to History Array for CSV
    const timestamp = new Date().toLocaleTimeString();
    const state = {
        Senaryo_No: runCount,
        Zaman: timestamp,
        Standart_Arac: result.std,
        Agir_Vasita: result.heavy,
        Elektrikli_Arac: result.ev,
        Bekleme_Suresi_sn: result.wait,
        Ruzgar_Hizi_kms: result.wind,
        Yesil_Alan_Yuzdesi: result.green,
        Hesaplanan_AQI: result.aqi,
        Durum: aqiInfo.text
    };
    recordedData.push(state);

    // 3. Update Chart
    aqiChart.data.labels.push(runCount);
    aqiChart.data.datasets[0].data.push(result.aqi);
    aqiChart.data.datasets[0].backgroundColor.push(aqiInfo.color);
    aqiChart.update();

    // 4. Update HTML Table
    if (runCount === 1) {
        tableBody.innerHTML = '';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>#${runCount}</td>
        <td>${result.std}</td>
        <td>${result.heavy}</td>
        <td>${result.ev}</td>
        <td>${result.wait}</td>
        <td>${result.wind}</td>
        <td>%${result.green}</td>
        <td><strong>${result.aqi}</strong></td>
        <td><span class="status-badge" style="background-color: ${aqiInfo.color}20; color: ${aqiInfo.color}">${aqiInfo.text}</span></td>
    `;
    
    tableBody.insertBefore(tr, tableBody.firstChild);
}

function clearHistory() {
    runCount = 0;
    recordedData = [];
    
    // Reset Chart
    aqiChart.data.labels = [];
    aqiChart.data.datasets[0].data = [];
    aqiChart.data.datasets[0].backgroundColor = [];
    aqiChart.update();
    
    // Reset Table
    tableBody.innerHTML = `<tr class="empty-row"><td colspan="9">Geçmiş temizlendi. Yeni senaryo çalıştırın.</td></tr>`;
    
    // Reset UI Circle
    aqiElements.value.textContent = '-';
    aqiElements.status.textContent = 'Bekleniyor';
    aqiElements.circle.style.borderColor = '#94a3b8';
    aqiElements.circle.style.boxShadow = 'none';
}

// --- CSV Export Logic ---
function downloadCSV() {
    if (recordedData.length === 0) {
        alert("İndirilecek veri yok. Önce 'Senaryoyu Çalıştır' butonuna basın.");
        return;
    }

    const headers = Object.keys(recordedData[0]);
    let csvContent = headers.join(',') + '\n';
    
    recordedData.forEach(row => {
        const values = headers.map(header => row[header]);
        csvContent += values.join(',') + '\n';
    });

    // Handle Turkish characters encoding for Excel
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `eco_route_senaryolar_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Event Listeners ---
runBtn.addEventListener('click', runSimulation);
clearBtn.addEventListener('click', clearHistory);
downloadBtn.addEventListener('click', downloadCSV);
