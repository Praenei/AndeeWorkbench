import { LightningElement, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import chart_bundle from '@salesforce/resourceUrl/chart_bundle';

export default class AndeeQuotes extends LightningElement {
    @track encryptedQuote = '';
    @track letter1 = '';
    @track letter2 = '';
    @track isGameWon = false;
    @track swapCount = 0;
    @track timeDiff = '';

    quotes = [
        'Ask not what your country can do for you, ask what you can do for your country - John F. Kennedy',
        'I have a dream that one day this nation will rise up - Martin Luther King Jr.',
        'The only thing we have to fear is fear itself - Franklin D. Roosevelt',
        'Two roads diverged in a wood, and I took the one less traveled - Robert Frost',
        'Those who cannot remember the past are condemned to repeat it - George Santayana',
        'The only true wisdom is in knowing you know nothing - Socrates',
        'Success is not final, failure is not fatal: it is the courage to continue that counts - Winston Churchill',
        'In three words I can sum up everything I\'ve learned about life: it goes on - Robert Frost',
        'Nearly all men can stand adversity, but if you want to test a man\'s character, give him power - Abraham Lincoln',
        'It is not the critic who counts, not the man who points out how the strong man stumbles - Theodore Roosevelt',
        'Education is not the filling of a pail, but the lighting of a fire - William Butler Yeats',
        'I have nothing to offer but blood, toil, tears, and sweat - Winston Churchill',
        'We shall defend our island, whatever the cost may be - Winston Churchill',
        'The journey of a thousand miles begins with a single step forward - Lao Tzu',
        'It is better to be hated for what you are than loved for what you are not - André Gide',
        'There is nothing permanent except change in this world - Heraclitus',
        'Whatever the mind of man can conceive and believe, it can achieve - Napoleon Hill',
        'The only way to do great work is to love what you do - Steve Jobs',
        'Darkness cannot drive out darkness; only light can do that - Martin Luther King Jr.',
        'We must learn to live together as brothers or perish together as fools - Martin Luther King Jr.',
        'The future belongs to those who believe in the beauty of their dreams - Eleanor Roosevelt',
        'Great minds discuss ideas; average minds discuss events; small minds discuss people - Eleanor Roosevelt',
        'It is during our darkest moments that we must focus to see the light - Aristotle',
        'Life is really simple, but we insist on making it complicated - Confucius',
        'The greatest glory in living lies not in never falling, but in rising every time we fall - Nelson Mandela',
        'You must be the change you wish to see in the world - Mahatma Gandhi',
        'There is no greater agony than bearing an untold story inside you - Maya Angelou',
        'The purpose of our lives is to be happy and make others happy - Dalai Lama',
        'The only impossible journey is the one you never begin in life - Tony Robbins',
        'Do not go gentle into that good night, rage against the dying of the light - Dylan Thomas',
        'The only thing necessary for the triumph of evil is for good men to do nothing - Edmund Burke',
        'You can fool all the people some of the time, and some of the people all the time - Abraham Lincoln',
        'Life is what happens to you while you\'re busy making other plans - John Lennon',
        'The best way to predict the future is to create it yourself - Abraham Lincoln',
        'To be yourself in a world that is constantly trying to make you something else - Ralph Waldo Emerson',
        'In matters of style, swim with the current; in matters of principle, stand like a rock - Thomas Jefferson',
        'A leader is one who knows the way, goes the way, and shows the way - John C. Maxwell',
        'If you want to test a man\'s character, give him power and watch - Abraham Lincoln',
        'Be the person your dog thinks you are every single day - J.W. Stephens',
        'The way to get started is to quit talking and begin doing - Walt Disney',
        'Your time is limited, so don\'t waste it living someone else\'s life - Steve Jobs',
        'If life were predictable it would cease to be life, and be without flavor - Eleanor Roosevelt',
        'If you look at what you have in life, you\'ll always have more. If you look at what you don\'t have in life, you\'ll never have enough - Oprah Winfrey',
        'If you set your goals ridiculously high and it\'s a failure, you will fail above everyone else\'s success - James Cameron',
        'Life is what happens when you\'re busy making other plans - John Lennon',
        'Spread love everywhere you go. Let no one ever come to you without leaving happier - Mother Teresa',
        'When you reach the end of your rope, tie a knot in it and hang on - Franklin D. Roosevelt',
        'Always remember that you are absolutely unique. Just like everyone else - Margaret Mead',
        'Don\'t judge each day by the harvest you reap but by the seeds that you plant - Robert Louis Stevenson',
        'Tell me and I forget. Teach me and I remember. Involve me and I learn - Benjamin Franklin',
        'The best and most beautiful things in the world cannot be seen or even touched - they must be felt with the heart - Helen Keller',
        'Whoever is happy will make others happy too - Anne Frank',
        'Do not go where the path may lead, go instead where there is no path and leave a trail - Ralph Waldo Emerson',
        'You will face many defeats in life, but never let yourself be defeated - Maya Angelou',
        'The only impossible journey is the one you never begin - Tony Robbins',
        'In the end, it\'s not the years in your life that count. It\'s the life in your years - Abraham Lincoln',
        'Life is a succession of lessons which must be lived to be understood - Ralph Waldo Emerson',
        'You only live once, but if you do it right, once is enough - Mae West',
        'Life itself is the most wonderful fairy tale - Hans Christian Andersen',
        'Do not let making a living prevent you from making a life - John Wooden',
        'Life is ours to be spent, not to be saved - D. H. Lawrence',
        'Keep smiling, because life is a beautiful thing and there\'s so much to smile about - Marilyn Monroe',
        'Life is a long lesson in humility - James M. Barrie',
        'Love the life you live. Live the life you love - Bob Marley',
        'Life is either a daring adventure or nothing at all - Helen Keller',
        'You have within you right now, everything you need to deal with whatever the world can throw at you - Brian Tracy',
        'Believe you can and you\'re halfway there - Theodore Roosevelt',
        'The only limit to our realization of tomorrow is our doubts of today - Franklin D. Roosevelt',
        'Do what you can, with what you have, where you are - Theodore Roosevelt',
        'May you live all the days of your life - Jonathan Swift',
        'Life is made of ever so many partings welded together - Charles Dickens',
        'Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work - Steve Jobs',
        'The purpose of our lives is to be happy - Dalai Lama',
        'Get busy living or get busy dying - Stephen King',
        'Never underestimate a man who overestimates himself - Franklin D. Roosevelt',
        'Finance: the art of passing currency from hand to hand until it finally disappears - Robert W. Sarnoff',
        'I\'ve done the calculation, and your chances of winning the lottery are identical whether you play or not - Fran Lebowitz',
        'The cause of America is in great measure the cause of all mankind - Thomas Paine',
        'It\'s never a good idea to provoke people who own tractors - Emma Duncan',
        'I do not have to forgive my enemies, I have had them all shot - Ramon Maria Narvaez',
        'When I became a man I put away childish things, including the fear of childishness and the desire to be very grown up - C. S. Lewis',
        'Winning is a habit. Unfortunately so is losing - Vince Lombardi',
        'There is no doubt that fiction makes a better job of the truth - Doris Lessing',
        'Any sufficiently advanced technology is indistinguishable from magic - Arthur C. Clarke',
        'I do not believe that friends are necessarily the people you like the best, they are mearly the people who got there first - Peter Ustinov',
        'When a girl marries, she exchanges the attention of many men for the inattention of one - Helen Rowland',
        'The big joke on democracy is that it gives its mortal enemies the tools by which it can be destroyed - Joseph Goebbels',
        'Anyone who has struggled with poverty knows how extremely expensive it is to be poor - James Baldwin',
        'Dogs\' lives are too short. Their only fault, really - Agnes Sligh Turnbull',
        'Good things are easily destroyed, but not easily created - Roger Scruton',
        'Democracy is being allowed to vote for the candidate you dislike least - Robert Byrne',
        'I don\'t chase records. They chase me - Cristiano Ronaldo',
        'New Zealanders who leave for Australia raise th IQ of both countries - Rob Muldoon',
        'No ship sets out to be a shipwreck - Joan Wickersham',
        'I\'m not going to rearrange the furniture on the deck of the Titanic - Rogers Morton',
        'The difference between communism and capitalism? In capitalism, man exploits man. In communism, it\'s the other way around - Daniel Bell'
    ];
    @track originalQuote = '';
    frequencyData = {};
    chartInitialized = false;
    alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    letterClassMap = {};
    chartJsLoaded = false;
    chartInstance = null; // Add a property to hold the chart instance
    startDateTime = new Date().getTime();

    connectedCallback() {
        this.selectRandomQuote();
        this.applyRandomTransposition();
        this.generateFrequencyData();
        this.loadChartScripts();
        this.initializeLetterClassMap();
    }

    initializeLetterClassMap() {
        this.alphabet.forEach(letter => {
            this.letterClassMap[letter] = 'letter-button';
        });
    }

    selectRandomQuote() {
        const randomIndex = Math.floor(Math.random() * this.quotes.length);
        this.originalQuote = this.quotes[randomIndex];
    }

    applyRandomTransposition() {
        const letters = 'abcdefghijklmnopqrstuvwxyz';
        const shuffledLetters = letters.split('').sort(() => Math.random() - 0.5).join('');
        const transpositionMap = {};
    
        for (let i = 0; i < letters.length; i++) {
            transpositionMap[letters[i]] = shuffledLetters[i];
        }
    
        this.encryptedQuote = this.originalQuote.replace(/[a-z]/gi, char => {
            const lowerChar = char.toLowerCase();
            const transposedChar = transpositionMap[lowerChar];
            return char === lowerChar ? transposedChar : transposedChar.toUpperCase();
        });
    }

    generateFrequencyData() {
        this.frequencyData = {};
        // Initialize frequency data for all letters a-z
        for (let i = 0; i < 26; i++) {
            this.frequencyData[String.fromCharCode(97 + i)] = 0;
        }
        // Calculate frequency of each letter in the encrypted quote
        for (let char of this.encryptedQuote.toLowerCase()) {
            if (char.match(/[a-z]/)) {
                this.frequencyData[char] = (this.frequencyData[char] || 0) + 1;
            }
        }
    }

    loadChartScripts() {
        loadScript(this, chart_bundle)
        .then(() => {
            this.chartJsLoaded = true;
            this.renderChart();
        })
        .catch(error => {
            console.error('Error loading chart scripts', error);
        });
    }

    renderedCallback() {
        if (this.chartJsLoaded) {
            this.renderChart();
        }
    }

    renderChart() {
        if (this.chartJsLoaded) {
            const ctx = this.template.querySelector('.chart').getContext('2d');
            
            // Destroy the previous chart instance if it exists
            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            this.chartInstance = new window.Chart(ctx, {  // Ensure using window.Chart
                type: 'bar',
                data: {
                    labels: Object.keys(this.frequencyData).sort(),
                    datasets: [{
                        label: 'Letter Frequency',
                        data: Object.values(this.frequencyData)
                    }]
                },
                options: {
                    scales: {
                        y: {
                            ticks: {
                                stepSize: 1,
                                callback: function(value) { return Number.isInteger(value) ? value : null; }
                            }
                        }
                    }
                }
            });
        }
    }

    get letterClassMap() {
        const map = {};
        this.alphabet.forEach(letter => {
            map[letter] = this.letter1 === letter || this.letter2 === letter ? 'letter-button green' : 'letter-button grey';
        });
        return map;
    }

    handleLetterClick(event) {
        const selectedLetter = event.target.dataset.letter;
        if (!this.letter1) {
            this.letter1 = selectedLetter;
            event.target.variant='success'
        } else if (!this.letter2) {
            this.letter2 = selectedLetter;
            this.swapLetters();
            // Find the first button and revert its color to grey
            const firstButton = this.template.querySelector(`[data-letter="${this.letter1}"]`);
            if (firstButton) {
                firstButton.variant = 'neutral';
            }
            this.letter1 = '';
            this.letter2 = '';
        }
    }

    swapLetters() {
        this.swapCount++;
        const letter1 = this.letter1;
        const letter2 = this.letter2;
        this.encryptedQuote = this.encryptedQuote.split('').map(char => {
            if (char.toLowerCase() === letter1) {
                return char === letter1 ? letter2 : letter2.toUpperCase();
            } else if (char.toLowerCase() === letter2) {
                return char === letter2 ? letter1 : letter1.toUpperCase();
            }
            return char;
        }).join('');
        this.generateFrequencyData();
        this.renderChart();

        // Check if the decrypted quote matches the original quote
        const decryptedQuote = this.encryptedQuote.toLowerCase();
        if (decryptedQuote === this.originalQuote.toLowerCase()) {
            var endDate = new Date().getTime();

            var timeDiff = endDate - this.startDateTime;

            // convert timeDiff a text string indicating the number of hours(if there are any), minutes (if there are any), and seconds
            var tempTimeDiffText = '';
            var hours = Math.floor(timeDiff / 1000 / 60 / 60);
            if (hours > 0) {
                tempTimeDiffText += hours + ' hours ';
                timeDiff -= hours * 1000 * 60 * 60;
            }
            var minutes = Math.floor(timeDiff / 1000 / 60);
            if (minutes > 0) {
                tempTimeDiffText += minutes + ' minutes ';
                timeDiff -= minutes * 1000 * 60;
            }
            var seconds = Math.floor(timeDiff / 1000);
            tempTimeDiffText += seconds + ' seconds';

            this.timeDiff = tempTimeDiffText;            

            this.isGameWon = true;
        }
    }

    handleClose() {
        this.classList.add('slds-hide');
        this.dispatchEvent(new CustomEvent('closequotes', { detail: { isClosed: true } }));
    }
}