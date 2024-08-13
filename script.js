 $(document).ready(function() {
    const apiKey = '5f4d873818a73a289a5ddfa3a61ab466'; // OpenWeatherMap API key
    const apiUrl = 'https://api.openweathermap.org/data/2.5/weather';

    // Function to display weather data
    function displayWeather(data) {
        const unit = $('#unitToggle').val(); // Get selected unit
        let temperatureUnit;

        if (unit === 'metric') {
            temperatureUnit = '°C'; // Celsius symbol
        } else {
            temperatureUnit = '°F'; // Fahrenheit symbol
        }
        let windSpeed;
        if (unit === 'metric') {
            windSpeed = data.wind.speed; // Wind speed in m/s
        } else {
            windSpeed = data.wind.speed * 2.23694; // Convert m/s to mph
        }
        // Construct HTML content
        const weatherContent = `
            <h2>${data.name}</h2>
            <p>Temperature: ${data.main.temp} ${temperatureUnit}</p>
            <p>Humidity: ${data.main.humidity}%</p>
            <p>Wind Speed: ${windSpeed.toFixed(1)} ${unit === 'metric' ? 'm/s' : 'mph'}</p>
            <p>Conditions: ${data.weather[0].description}</p>
        `;
        
        // Fade out and then fade in the updated weather information
        $('#weatherInfo').fadeOut(function() {
            $(this).html(weatherContent).fadeIn();
        }).addClass('show');
    }

    // Function to handle errors
    function handleError() {
        $('#weatherInfo').fadeOut(function() {
            $(this).html('<p class="error">Unable to fetch weather data.</p>').fadeIn();
        }).addClass('show');
    }

    // Event handler for the search button
    $('#searchButton').click(function() {
        const city = $('#cityInput').val();
        if (city) {
            $('#loadingSpinner').show(); // Show spinner
            $.ajax({
                url: apiUrl,
                data: {
                    q: city,
                    appid: apiKey,
                    units: $('#unitToggle').val() // Pass selected unit to API
                },
                success: function(data) {
                    displayWeather(data);
                    $('#loadingSpinner').hide(); // Hide spinner
                },
                error: function() {
                    handleError();
                    $('#loadingSpinner').hide(); // Hide spinner
                }
            });
        } else {
            $('#weatherInfo').fadeOut(function() {
                $(this).html('<p class="error">Please enter a city name.</p>').fadeIn();
            }).addClass('show');
        }
    });

    // Allow Enter key to trigger search
    $('#cityInput').keypress(function(e) {
        if (e.which === 13) { // Enter key
            $('#searchButton').click();
        }
    });

    // Event handler for unit toggle change
    $('#unitToggle').change(function() {
        const city = $('#cityInput').val();
        if (city) {
            // Trigger search with updated unit
            $('#searchButton').click();
        }
    });
});
