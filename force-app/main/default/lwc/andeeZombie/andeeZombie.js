import { track } from 'lwc';
import LightningModal from 'lightning/modal';

import wallImage from '@salesforce/resourceUrl/zombieWall';
import pathImage from '@salesforce/resourceUrl/zombiePath';
import playerImage from '@salesforce/resourceUrl/zombiePlayer';
import zombieImage from '@salesforce/resourceUrl/zombieZombie';
import ghostImage from '@salesforce/resourceUrl/zombieGhost';
import moneyImage from '@salesforce/resourceUrl/zombieMoney';
import randomImage from '@salesforce/resourceUrl/zombieRandom';
import bombImage from '@salesforce/resourceUrl/zombieBomb';
import collisionImage from '@salesforce/resourceUrl/zombieCollision';
import skeletonImage from '@salesforce/resourceUrl/zombieSkeleton';

export default class AndeeZombie extends LightningModal {

    
    @track output = '';
    @track score = 0;
	@track level = 1;
    @track isGameStarted = false;
    @track isGameOver = false;
    @track message = '';
    @track isMessageVisible = false;
    @track noOfBombs = 3;

    wallImageUrl = wallImage;
    pathImageUrl = pathImage;
    playerImageUrl =  playerImage;
    zombieImageUrl = zombieImage;
    ghostImageUrl =  ghostImage;
    moneyImageUrl = moneyImage;
    randomImageUrl = randomImage;
    bombImageUrl = bombImage;
    collisionImageUrl = collisionImage;
    skeletonImageUrl = skeletonImage;

    listenerAttached = false;
    width = 20;
    height = 20;
    playArea = [];
	startingNumberOfZombies=3
	noOfWalls = 65;
	noOfDollars = 8;
	noOfQuestions = 5;
	playerChar = 'P';
	zombieChar = 'Z'
	ghostChar = 'G'
    wallChar = 'W';
    moneyChar = '$'
    randomChar = '?'
    bombChar = 'B';
    collisionChar = 'C';
    backgroundChar = ' ';
    skeletonChar = 'D';
	playArea2 = []; // Used to store playarea so that zombies do not remove money, ?, etc
    zombies = [];
	ghosts = [];
    collisions = [];
	exitX = 0;
	exitY = 0;
    playerX = 0;
    playerY = 0;
    isBombDropped = false;



    gameStart() {
        console.log('gameStart');
        this.isGameStarted = true;
        this.isGameOver = false;

        this.score = 0;
	    this.level = 1;

        this.initializePlayArea();
        this.renderPlayArea();
    }

    renderedCallback() {
        console.log('renderedCallback');

        if (!this.listenerAttached) {
            this.template.addEventListener('keydown', this.handleKeyDown.bind(this));
            this.listenerAttached = true;
        }
    }
    

    handleApplyClose() {
        this.close();
    }

    handleDefault() {
    }

    // Initialize the play area with spaces
    initializePlayArea() {

        console.log('initializePlayArea');

        for (let y = 0; y < this.height; y++) {
          this.playArea[y] = [];
          for (let x = 0; x < this.width; x++) {
            this.playArea[y][x] = this.backgroundChar;
          }
        }	  
        
        // Add random walls
        let asterisksAdded = 0;
        while (asterisksAdded < this.noOfWalls) {
          const x = Math.floor(Math.random() * (this.width - 4)) + 2;
          const y = Math.floor(Math.random() * (this.height - 4)) + 2;
  
          if (this.playArea[y][x] === this.backgroundChar) {
            this.playArea[y][x] = this.wallChar;
            asterisksAdded++;
          }
        }
  
        // Set the border
        for (let x = 0; x < this.width; x++) {
          this.playArea[0][x] = this.wallChar;
          this.playArea[this.height - 1][x] = this.wallChar;
        }
        for (let y = 1; y < this.height - 1; y++) {
          this.playArea[y][0] = this.wallChar;
          this.playArea[y][this.width - 1] = this.wallChar;
        }
        
        var rndExit = Math.random();
        if(rndExit < 0.25) {
          this.exitY = 0;
          this.exitX = Math.floor(Math.random() * (this.width - 2)) + 1;
          if(this.playArea[this.exitY+1][this.exitX] == this.wallChar){
              this.playArea[this.exitY+1][this.exitX] = this.backgroundChar;
          }
         } else if(rndExit < 0.5) {
              this.exitY = this.height - 1;
              this.exitX = Math.floor(Math.random() * (this.width - 2)) + 1;
              if(this.playArea[this.exitY-1][this.exitX] == this.wallChar){
                  this.playArea[this.exitY-1][this.exitX] = this.backgroundChar;
              }
          } else if(rndExit < 0.75) {
                  this.exitY = Math.floor(Math.random() * (this.height - 2)) + 1;
                  this.exitX = 0;
                  if(this.playArea[this.exitY][this.exitX+1] == this.wallChar){
                      this.playArea[this.exitY][this.exitX+1] = this.backgroundChar;
                  }
          } else {
              this.exitY = Math.floor(Math.random() * (this.height - 2)) + 1;
              this.exitX = this.width - 1;
              if(this.playArea[this.exitY][this.exitX-1] == this.wallChar){
                  this.playArea[this.exitY][this.exitX-1] = this.backgroundChar;
              }
          }
  
        this.playArea[this.exitY][this.exitX] = this.backgroundChar; // Remove one asterisk for the exit
  
        // Add money signs
        let dollarsAdded = 0;
        while (dollarsAdded < this.noOfDollars) {
          const x = Math.floor(Math.random() * (this.width - 2)) + 1;
          const y = Math.floor(Math.random() * (this.height - 2)) + 1;
  
          if (
            this.playArea[y][x] === this.backgroundChar) {
            this.playArea[y][x] = this.moneyChar;
            dollarsAdded++;
          }
        }
  
        // Add question marks (?)
        let questionsAdded = 0;
        while (questionsAdded < this.noOfQuestions) {
          const x = Math.floor(Math.random() * (this.width - 2)) + 1;
          const y = Math.floor(Math.random() * (this.height - 2)) + 1;
  
          if (
            this.playArea[y][x] === this.backgroundChar) {
            this.playArea[y][x] = this.randomChar;
            questionsAdded++;
          }
        }
        
        for (let y = 0; y < this.height; y++) {
          this.playArea2[y] = [];
          for (let x = 0; x < this.width; x++) {
            this.playArea2[y][x] = this.playArea[y][x];
          }
        }	
  
        // clear ghosts
        this.ghosts.length = 0;
  
        // Add random zombies
        this.zombies.length = 0; // Clear existing zombies
        for (let i = 0; i < this.startingNumberOfZombies + Math.floor(this.score / 1000); i++) {
            let zombieX, zombieY;
            do {
                zombieX = Math.floor(Math.random() * (this.width - 2)) + 1;
                zombieY = Math.floor(Math.random() * (this.height - 2)) + 1;
            } while (
                this.playArea[zombieY][zombieX] !== this.backgroundChar);
                this.playArea[zombieY][zombieX] = this.zombieChar;
                this.zombies.push({ x: zombieX, y: zombieY, active: true });
        }
  
        // Set the player's initial position
        let noPlayer = true;
        while (noPlayer) {
            this.playerX = Math.floor(Math.random() * (this.width - 2)) + 1;
            this.playerY = Math.floor(Math.random() * (this.height - 2)) + 1;
            
            if(this.playArea[this.playerY][this.playerX] === this.backgroundChar){
              this.playArea[this.playerY][this.playerX] = this.playerChar;
              noPlayer = false;
            }
        }
    }
  
    // Render the play area
    renderPlayArea() {
        console.log('renderPlayArea');
        this.output = this.playArea.map(row => row.join('')).join('\n');
    }
      
    updateLevelDisplay() {
        console.log('updateLevelDisplay');
        this.level++;
    }
  
    // Calculate the distance between two points
    distance(x1, y1, x2, y2) {
        console.log('distance');
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }
      
    // Move a zombie towards the player
    moveZombieTowardsPlayer(zombie) {
        console.log('moveZombieTowardsPlayer');
        
        let newPos = this.getRandomDirection(this.playerX, this.playerY, zombie.x, zombie.y)
        let newX = newPos.x;
        let newY = newPos.y;

        if(this.playArea[newY][newX] === this.bombChar){
            this.playArea[zombie.y][zombie.x] = this.backgroundChar;
            this.playArea[newY][newX] = this.collisionChar;
            this.playArea2[newY][newX] = this.backgroundChar;
            this.collisions.push({ x: newX, y: newY });
            zombie.active = false;
            return;
        }
  
        if (this.playArea[newY][newX] === this.backgroundChar || this.playArea[newY][newX] === this.moneyChar || this.playArea[newY][newX] === this.randomChar || this.playArea[newY][newX] === this.playerChar) {
          this.playArea[zombie.y][zombie.x] = this.playArea2[zombie.y][zombie.x];
          zombie.x = newX;
          zombie.y = newY;
          this.playArea[newY][newX] = this.zombieChar;
        }
    }
      
    // Move a ghost towards the player
    moveGhostTowardsPlayer(ghost) {
        console.log('moveGhostTowardsPlayer');
        
        let newPos = this.getRandomDirection(this.playerX, this.playerY, ghost.x, ghost.y)
        let newX = newPos.x;
        let newY = newPos.y;

        if(this.playArea[newY][newX] === this.bombChar){
            this.playArea[ghost.y][ghost.x] = this.backgroundChar;
            this.playArea[newY][newX] = this.collisionChar;
            this.playArea2[newY][newX] = this.backgroundChar;
            this.collisions.push({ x: newX, y: newY });
            ghost.active = false;
            return;
        }
  
        if (this.playArea[newY][newX] === this.backgroundChar || this.playArea[newY][newX] === this.moneyChar || this.playArea[newY][newX] === this.randomChar || this.playArea[newY][newX] === this.playerChar || this.playArea[newY][newX] === this.wallChar) {
          this.playArea[ghost.y][ghost.x] = this.playArea2[ghost.y][ghost.x];
          ghost.x = newX;
          ghost.y = newY;
          this.playArea[newY][newX] = this.ghostChar;
        }
    }
      
    getRandomDirection(x1, y1, x2, y2) {
        console.log('getRandomDirection');
          // Calculate absolute differences
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        
  
        // Calculate the sum of differences
        const totalDiff = dx + dy;
  
        // Generate a random number within the range [1, totalDiff]
        const randomValue = Math.floor(Math.random() * totalDiff) + 1;
  
        // Check if the random value is less than or equal to dx
        if (randomValue <= dx) {
          if (x1 > x2){
              x2 = x2 + 1;
          } else {
              x2 = x2 - 1;
          }
        } else {
          if (y1 > y2){
              y2 = y2 + 1;
          } else {
              y2 = y2 - 1;
          }
        }
        return { x: x2, y: y2 };
    }
  
    // Move zombies randomly or towards the player
    moveZombies() {
        console.log('moveZombies');
        for (const zombie of this.zombies) {

            if(zombie.active==false){
                continue;
            }
            const dist = this.distance(zombie.x, zombie.y, this.playerX, this.playerY);
            if (dist <= 15) {
                this.moveZombieTowardsPlayer(zombie);
            } else if (dist > 40) {
                const dx = Math.floor(Math.random() * 3) - 1;
                const dy = Math.floor(Math.random() * 3) - 1;
                const newX = zombie.x + dx;
                const newY = zombie.y + dy;                

                if(this.playArea[newY][newX] === this.bombChar){ 
                    this.playArea[zombie.y][zombie.x] = this.backgroundChar;                 
                    this.playArea[newY][newX] = this.collisionChar;
                    this.playArea2[newY][newX] = this.backgroundChar;
                    this.collisions.push({ x: newX, y: newY });
                    zombie.active = false;
                } else if (this.playArea[newY][newX] === this.backgroundChar || this.playArea[newY][newX] === this.moneyChar || this.playArea[newY][newX] === this.randomChar || this.playArea[newY][newX] === this.playerChar) {
                    this.playArea[zombie.y][zombie.x] = this.playArea2[zombie.y][zombie.x];
                    zombie.x = newX;
                    zombie.y = newY;
                    this.playArea[newY][newX] = this.zombieChar;
                }
            } else {
                const moveTowardsPlayer = Math.random() < 0.5;
                if (moveTowardsPlayer) {
                    this.moveZombieTowardsPlayer(zombie);
                } else {
                    const dx = Math.floor(Math.random() * 3) - 1;
                    const dy = Math.floor(Math.random() * 3) - 1;
                    const newX = zombie.x + dx;
                    const newY = zombie.y + dy;
                    
                    if(this.playArea[newY][newX] === this.bombChar){  
                        this.playArea[zombie.y][zombie.x] = this.backgroundChar;                      
                        this.playArea[newY][newX] = this.collisionChar;
                        this.playArea2[newY][newX] = this.backgroundChar;
                        this.collisions.push({ x: newX, y: newY });
                        zombie.active = false;
                    } else if (this.playArea[newY][newX] === this.backgroundChar || this.playArea[newY][newX] === this.moneyChar || this.playArea[newY][newX] === this.randomChar || this.playArea[newY][newX] === this.playerChar) {
                        this.playArea[zombie.y][zombie.x] = this.playArea2[zombie.y][zombie.x];
                        zombie.x = newX;
                        zombie.y = newY;
                        this.playArea[newY][newX] = this.zombieChar;
                    }
                }
            }
        }
    }
      
    // Move zombies randomly or towards the player
    moveGhosts() {
        console.log('moveGhosts');
        for (const ghost of this.ghosts) {
            if(ghost.active==true){
                this.moveGhostTowardsPlayer(ghost);
            }
        }
    }
  
    // Handle player movement and special events
    movePlayer(dx, dy) {
        console.log('movePlayer');
        this.message = '';
        this.isMessageVisible = false;  
        
        // remove any existing collisions
        for (const collision of this.collisions) {
            this.playArea[collision.y][collision.x] = this.backgroundChar;
        }
        this.collisions.length = 0;

        const newX = this.playerX + dx;
        const newY = this.playerY + dy;
        this.score = this.score - 1;

        // Check if the new position is valid (not an asterisk)
        if (this.playArea[newY][newX] !== this.wallChar) {

            // If a bomb was previously placed, mark it on the maze
            if(this.isBombDropped){
                this.isBombDropped = false;
                this.playArea[this.playerY][this.playerX] = this.bombChar;
            } else {
                // Clear the player's current position
                this.playArea[this.playerY][this.playerX] = this.backgroundChar;
                this.playArea2[this.playerY][this.playerX] = this.backgroundChar;
            }
    
            // Update the player's position
            this.playerX = newX;
            this.playerY = newY;
    
            // Handle special events
            if (this.playArea[this.playerY][this.playerX] === this.moneyChar) {
                this.score += 100;
            } else if (this.playArea[this.playerY][this.playerX] === this.randomChar) {
                this.isMessageVisible = true;
                const randomEvent = Math.floor(Math.random() * 4);
                switch (randomEvent) {
                case 0:
                    this.message = 'You found hidden gold!';
                    this.score += 100;
                    break;
                case 1:
                    this.message = 'Oops, you have woken a ghost!';
                    let ghostX, ghostY;
                    do {
                    ghostX = Math.floor(Math.random() * (this.width - 2)) + 1;
                    ghostY = Math.floor(Math.random() * (this.height - 2)) + 1;
                    } while (
                    this.playArea[ghostY][ghostX] !== this.backgroundChar
                    );
                    this.playArea[ghostY][ghostX] = this.ghostChar;
                    this.ghosts.push({ x: ghostX, y: ghostY, active: true });
                    break;
                case 2:
                    this.message = 'Teleport time!';
                    let newPlayerX, newPlayerY;
                    do {
                    newPlayerX = Math.floor(Math.random() * (this.width - 2)) + 1;
                    newPlayerY = Math.floor(Math.random() * (this.height - 2)) + 1;
                    } while (
                    this.playArea[newPlayerY][newPlayerX] !== this.backgroundChar
                    );
                    this.playArea[this.playerY][this.playerX] = this.backgroundChar;
                    this.playerX = newPlayerX;
                    this.playerY = newPlayerY;
                    break;
                case 3:
                    this.message = 'You found a bomb!';
                    this.noOfBombs++;
                    break;
                }
                this.playArea[this.playerY][this.playerX] = this.backgroundChar;
            }
    
            // Set the player's new position
            this.playArea[this.playerY][this.playerX] = this.playerChar;
        }
        // Check if player reached the exit
        console.log(this.playerY +'='+ this.exitY +', '+ this.playerX +'='+ this.exitX);
        if (this.playerY === this.exitY && this.playerX === this.exitX) {
            this.score += 100;
            this.updateLevelDisplay();
            this.startingNumberOfZombies++;
            this.initializePlayArea(); // Regenerate play area with one additional zombie
        } else {
        
            // Check for game over
            if(this.isCaught(this.playerY, this.playerX)){                
                this.renderPlayArea();
                return;
            }
            
            // Move zombies
            this.moveZombies();
            this.moveGhosts();
    
            
            if(this.isCaught(this.playerY, this.playerX)){
                this.renderPlayArea();
                return;
            }
        }
        this.renderPlayArea();
        
    }
      
    isCaught(){
        console.log('isCaught');
        for (const zombie of this.zombies) {
            if (zombie.x === this.playerX && zombie.y === this.playerY && zombie.active) {
                this.playArea[this.playerY][this.playerX] = this.skeletonChar;
                
                this.isGameOver = true;
                return true;
            }
        }
          
        for (const ghost of this.ghosts) {
            if (ghost.x === this.playerX && ghost.y === this.playerY && ghost.active) {
                this.playArea[this.playerY][this.playerX] = this.skeletonChar;              

                this.isGameOver = true;
                return true;
            }
        }
          
    }
  
    // Keyboard event listeners
    handleKeyDown(event) {
        console.log('handleKeyDown');
        if(this.isGameOver == true || this.isGameStarted == false){
            return;
        }

        switch (event.key) {
            case 'ArrowUp':
                this.movePlayer(0, -1); // Move up
                break;
            case 'ArrowDown':
                this.movePlayer(0, 1); // Move down
                break;
            case 'ArrowLeft':
                this.movePlayer(-1, 0); // Move left
                break;
            case 'ArrowRight':
                this.movePlayer(1, 0); // Move right
                break;
            case 'b':
                if(this.noOfBombs > 0){
                    this.placeBomb();
                }
                break;
        }
    }

    placeBomb(){
        console.log('placeBomb');
        this.isBombDropped = true;
        this.message = 'Bomb placed!';
        this.noOfBombs--;
        this.isMessageVisible = true;
    }

    get mazeRows() {
        console.log('mazeRows');
        let rows = [];

        let rowSplit = this.output.split('\n');
        for (let i = 0; i < rowSplit.length; i++) {
            let row = rowSplit[i];
            let rowArray = [];
            for (let j = 0; j < row.length; j++) {
                let char = row[j];
                let isWall = char === this.wallChar;
                let isPath = char === this.backgroundChar;
                let isPlayer = char === this.playerChar;
                let isZombie = char === this.zombieChar;
                let isGhost = char === this.ghostChar;
                let isMoney = char === this.moneyChar;
                let isRandom = char === this.randomChar;
                let isBomb = char === this.bombChar;
                let isCollision = char === this.collisionChar;
                let isSkeleton = char === this.skeletonChar;
                rowArray.push({
                    isWall: isWall,
                    isPath: isPath,
                    isPlayer: isPlayer,
                    isZombie: isZombie,
                    isGhost: isGhost,
                    isMoney: isMoney,
                    isRandom: isRandom,
                    isBomb: isBomb,
                    isCollision: isCollision,
                    isSkeleton: isSkeleton
                });
            }
            rows.push(rowArray);
        }

        return rows;
    }
}
