
import { LightningElement, track, wire } from 'lwc';
import andeeExecuteAnonController from '@salesforce/apex/AndeeExecuteAnonController.executeAnonymousApex';
import getDebugLog from '@salesforce/apex/AndeeExecuteAnonController.getDebugLog';
import startDebugSession from '@salesforce/apex/AndeeExecuteAnonController.startDebugSession';

export default class AndeeExecuteAnon extends LightningElement {
    @track apexCode = '';
    @track result;
    @track debugLog = '';
    @track isLoading = false;

    handleApexCodeChange(event) {
        this.apexCode = event.target.value;
    }

    executeApex() {
        this.isLoading = true;
        this.debugLog = '';
        var debugId = null;

        startDebugSession()
            .then(result => {

                console.log('start debug session result : ', result);

                if(result != null){
                    const resultObject = JSON.parse(result);
                    if(resultObject.id) {
                        debugId = resultObject.id;
                    }
                }

                console.log('debugId:' + debugId);

                andeeExecuteAnonController({ apexCode: this.apexCode})
                    .then(result => {

                        console.log('execute anon result : ', result);
                        const resultObject = JSON.parse(result); 
                        console.dir(resultObject);

                        if(resultObject.compiled === true && resultObject.success === true) {
                            this.result = '';
                            getDebugLog({"debugId": debugId})
                                .then(result => {
                                    console.log('get debug log result : ', result);
                                    const regex = /^\d+:\d{2}:\d{2}\.\d+ \(\d+\)\|USER_DEBUG\|\[\d+\]\|DEBUG\|([^\n]+)/gm;
                                    const matches = [...result.matchAll(regex)];
                                    const debugs = matches.map(match => match[1]);
                                    this.debugLog = debugs.join('\n');
                                    this.isLoading = false;
                                    
                                })
                                .catch(error => {
                                    console.log('get debug log error : ');
                                    console.dir(error);
                                    this.result = 'Error: ' + error.body.message;
                                    this.isLoading = false;
                                });
                        } else {
                            if(resultObject.compiled === false) {
                                this.result = 'Error - line :' + resultObject.line + ', column : ' + resultObject.column + ', '+ resultObject.compileProblem;
                            } else {
                                this.result = 'Error - line :' + resultObject.line + ', column : ' + resultObject.column + ', '+ resultObject.exceptionMessage;
                            }
                            this.isLoading = false;
                        }

                        
                        
                    })
                    .catch(error => {
                        console.log('error : anonymous apex');
                        console.dir(error);
                        this.result = 'Error: ' + error.body.message;
                        this.isLoading = false;
                    });

            })
            .catch(error => {
                console.log('error : starting debug session');
                console.dir(error);
                this.result = 'Error: ' + error.body.message;
                this.isLoading = false;
            });
    }
    

    handleClose() {
        this.classList.add('slds-hide');
        this.dispatchEvent(new CustomEvent('closeexecanon', { detail: { isClosed: true } }));
    }

    

    
}
