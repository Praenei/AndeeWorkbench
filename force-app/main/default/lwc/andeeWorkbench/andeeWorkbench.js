import { LightningElement, wire, track } from 'lwc';

// Import Apex methods
import getAllObjects from '@salesforce/apex/AndeeWorkbenchController.GetAllObjects';
import getFieldsForObject from '@salesforce/apex/AndeeWorkbenchController.GetFieldsForObject';
import submitQuery from '@salesforce/apex/AndeeWorkbenchController.SubmitQuery';
import submitCountQuery from '@salesforce/apex/AndeeWorkbenchController.SubmitCountQuery';
import submitQueryTsv from '@salesforce/apex/AndeeWorkbenchController.SubmitQueryTsv';
import GetSettings from '@salesforce/apex/AndeeWorkbenchController.GetSettings';
import getSingleEntryData from '@salesforce/apex/AndeeWorkbenchController.GetSingleEntryData';
import updateSingleEntryData from '@salesforce/apex/AndeeWorkbenchController.UpdateSingleEntryData';
import deleteEntry from '@salesforce/apex/AndeeWorkbenchController.DeleteEntry';
import undeleteEntry from '@salesforce/apex/AndeeWorkbenchController.UndeleteEntry';
import insertSingleEntryData from '@salesforce/apex/AndeeWorkbenchController.InsertSingleEntryData';
import GetIsSandbox from '@salesforce/apex/AndeeWorkbenchController.RunningInASandbox';
import addQueryToFavourites from '@salesforce/apex/AndeeWorkbenchController.AddQueryToFavourites';
import deleteFavourite from '@salesforce/apex/AndeeWorkbenchController.DeleteFavourite';
import getUsersFavouriteQueries from '@salesforce/apex/AndeeWorkbenchController.GetUsersFavouriteQueries';
import reorderFavouriteQueries from '@salesforce/apex/AndeeWorkbenchController.ReorderFavouriteQueries';

import getDownloadUrls from '@salesforce/apex/BatchAndeeWorkbench.GetDownloadUrls';
import submitQueryBatch from '@salesforce/apex/BatchAndeeWorkbench.SubmitQueryBatch';
import getBatchJobStatus from '@salesforce/apex/BatchAndeeWorkbench.GetBatchJobStatus';

import andeeZombie from 'c/andeeZombie';
import andeeQuotes from 'c/andeeQuotes';
import areYouSure from 'c/areYouSure';

export default class AndeeWorkbench extends LightningElement {
    
    // Track variables for component state
    @track isLoading = true;
    @track error;
    
    @track objectValue = "";
    @track objectOptions = [];
    
    @track fieldOptions = [];
    @track fieldWhereOptions = [];

    @track soqlQuery = '';

    @track queryHeadings = [];
    @track queryResults = [];

    @track batchJobId;
    @track jobStatus;
    @track contentDocumentId;
    @track isBatchJobCompleted;
    @track selectedSingleRecordId;
    @track selectedSingleRecordObject;
    @track displayQueryResults = false;
    @track rowData = [];
    @track totalRowCountWithNoLimit;
    @track isDisplaySingleId = false;
    @track isDisplayFavs = false;
    @track isUpdateView = false;
    @track isInsertView = false;
    @track isDeleted = false;
    @track isZombieGame = false;
    @track limit = "500";
    @track hideInfoDiv = true;
    @track convertDateTime;
    @track isShowFieldLabels = false;
    @track isShowObjectLabels = false;
    @track usersFavouriteQueries = [];

    @track primarySortField = '';
    @track primarySortOrder = '';

    @track downloadUrls;

    @track isQuotesGame = false;


    
    allObjects = []; // contains an array of all the objects in the Salesforce instance (ApiName + Label)

    fieldArrayLowercase = []; // contains an array of the fields for the selected object, including the field name and whether it is filterable etc     
    fieldArrayCaseSensitive = []; // Same as fieldArrayLowercase but field name is case sensitive

    selectedFields = []; // contains an array of the fields selected by the user from the dropdown
    whereClause = ""; // contains the total where clause when a field is selected/unselected on the dropdown
    sortOrder = "";
    parsedSoql = {}; // contains the different parts of the SOQL query e.g. fields, objectName, whereClauses, orderByClauses, limitValue

    orgDomainUrl = "";
    usersTimezone = "";

    chainOfSingleRowIds = []; // Used to control where the user goes after hitting the back button e.g. previous single row data or query

    querySave = [];
    querySavePosition = 0;

    pageOfData = 0;

    isSandbox = false;
    

    // Initialization function when component is loaded
    connectedCallback() {
        console.log('starting connectedCallback');

        this.convertDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        // Get the organization's domain URL & the user's timezone
        GetSettings()
        .then(result => {
            this.orgDomainUrl = result.OrgDomainUrl  + '/';
            this.usersTimezone = result.UsersTimezone

            console.log('running GetIsSandbox');
            GetIsSandbox()
            .then(result => {
                this.isSandbox = result;
                console.log('isSandbox: ' + this.isSandbox);
            })
            .catch(error => {
                window.console.log('error (connectedCallback.GetIsSandbox) =====> '+JSON.stringify(error));
                if(error) {
                    this.error = error.body.message;
                    window.console.log('@@@@ ERROR '+ error);
                }
            })


        })
        .catch(error => {
            window.console.log('error (connectedCallback) =====> '+JSON.stringify(error));
            if(error) {
                this.error = error.body.message;
                window.console.log('@@@@ ERROR '+ error);
            }
        })
    }

    // Stop the browswer's back button from working
    renderedCallback() {
        if (this.isBackNavigationPrevented) return;
        this.isBackNavigationPrevented = true;
        this.template.querySelector('c-disable-back-button').preventBackNavigation();
    }

    // Wire adapter to get all Salesforce objects
    @wire(getAllObjects)
    wiredAllObjects({ error, data }) {
        if (data) {
            // Transform data into options for the object select dropdown
            var returnOpts = [];
            returnOpts = [ ...returnOpts, {label: '--None--', value: ''} ];
            this.allObjects = data;
            for (var i = 0; i < this.allObjects.length; i++) {
                returnOpts = [ ...returnOpts, {label: this.allObjects[i].ApiName, value: this.allObjects[i].ApiName} ];
            }

            // sort returnOpts by label
            returnOpts.sort((a, b) => (a.label > b.label) ? 1 : -1);
            this.objectOptions = returnOpts;
            this.isLoading = false;
        } else if (error) {
            this.error = error.body.message;
            console.error('error (wiredAllObjects) => ', error);
            this.isLoading = false;
        }
    }

    // Function to get fields for a selected object
    async getFields(reGenerateQuery = true){
        console.log('starting getFields : ' + this.objectValue);
        var idExists = false;
        getFieldsForObject({objectName : this.objectValue})
        .then(data => {
            var returnOpts = [];
            var whereOpts = [];
            this.fieldArray = [];
            var allValues = [];
            allValues = data;
            for (var i = 0; i < allValues.length; i++) {
                // Create options for field select dropdown
                if(allValues[i].Name=='Id'){
                    idExists = true;
                }
                returnOpts = [ ...returnOpts, {label: allValues[i].Name, value: allValues[i].Name, selected: (allValues[i].Name=='Id')?true:false, key:this.objectValue+'-'+allValues[i].Name} ];
                if(allValues[i].Filterable){
                    // Create options for where clause fields
                    whereOpts = [ ...whereOpts, {label: allValues[i].Name, value: allValues[i].Name, selected: false} ];
                }
                this.fieldArrayLowercase[allValues[i].Name.toLowerCase()] = allValues[i];
                
            }
            this.fieldArrayCaseSensitive = allValues;
            this.fieldOptions = returnOpts;
            this.fieldWhereOptions = whereOpts;

            this.selectedFields = [];

            if (reGenerateQuery){
                if(idExists){
                    this.selectedFields = ['Id'];
                }

                // reset the order by & where clauses
                this.sortOrder = '';
                this.template.querySelector('[data-id="QB_orderby_field"]').value = '';
                this.whereClause = '';

                for (var i = 0; i < 99; i++) {
                    var whereFields = this.template.querySelector('[data-id="QB_filter_field_'+i+'"]')
                    if (whereFields) {
                        whereFields.value = '';
                    } else {
                        break;
                    }
                }
                this.limit = '500';

                this.rebuildQuery();
            } 
            
            this.isLoading = false;
            this.error = undefined;
        })
        .catch(error => {
            this.error = error.body.message;
            console.error('error (getFieldsForObject) => ', error);
            this.isLoading = false;
        })
    }

    objectChanged(event){
        console.log('starting objectChanged');
        this.isLoading = true;

        this.objectValue = event.target.value;
        console.log('objectValue: ' + this.objectValue);
        this.getFields();
    }
    

    // Function to submit a SOQL query
    submitQuery(){
        console.log('starting submitQuery');
        this.isLoading = true;
        this.jobStatus = null;
        this.pageOfData = 0;

        // Get the SOQL query from the textarea
        this.soqlQuery = this.template.querySelector('[data-id="soql_query_textarea"]').value;

        this.parsedSoql = this.parseSoql(this.soqlQuery);

        console.log(this.parsedSoql.fields.length + ' : ' + this.parsedSoql.fields[0].toLowerCase());

        // If only a count() required        
        if(this.parsedSoql.fields.length == 1 && this.parsedSoql.fields[0].toLowerCase() == 'count()'){

            console.log('Performing count query');

            // If count is true, submit a count query
            submitCountQuery({objectApiName : this.parsedSoql.objectName,
                whereClause : this.parsedSoql.whereClauses,
                allRows : this.template.querySelector('[data-id="excludeDeleted"]').checked})
                .then(data => {
                    // Process count query results

                    this.displayQueryResults = true;
                    this.queryResults = [];
                    this.totalRowCountWithNoLimit = undefined;
                    this.queryHeadings = [{name:'Count()'}];

                    this.queryResults = [{"Fields":[{"Name":"Count()","Value":data}]}];

                    // remove the query from the array
                    if(this.querySave.includes(this.soqlQuery)){
                        this.querySave = this.querySave.filter(e => e !== this.soqlQuery);
                    }
                    // Add the query to the end of the array
                    this.querySave = [ ...this.querySave, this.soqlQuery ];
                    this.querySavePosition = this.querySave.length;

                    this.pageOfData++;
              
                    this.isLoading = false;
                    this.error = undefined;
            
            })
            .catch(error => {
                this.error = error.body.message;
                console.error('error (submitQueryCount) => ', error);
                this.isLoading = false;
            })


        // Else normal query    
        } else {

            console.log('Performing regular query');

            // Submit a regular SOQL query
            submitQuery({objectApiName : this.parsedSoql.objectName,
                fields : this.parsedSoql.fields,
                whereClause : this.parsedSoql.whereClauses, 
                sortOrder : this.parsedSoql.orderByClauses, 
                limitCount : this.parsedSoql.limitValue,
                allRows : this.template.querySelector('[data-id="excludeDeleted"]').checked,
                offset : ''})
            .then(data => {

                // Process query results
                this.displayQueryResults = true;
                this.queryHeadings = [];
                this.queryResults = [];
                var results = [];
                var fields = [];
                this.totalRowCountWithNoLimit = data.TotalRowCountWithNoLimit;
                fields = data.Fields;
                var headings = [];
                var fieldMap = {};

                // Only display data is it exists
                if (fields != null){


                    if(fields.length>0){
                        for (var i = 0; i < fields.length; i++) {
                            headings = [ ...headings, {name:fields[i].Name, isPrimarySort:fields[i].Name.toLowerCase()==this.primarySortField, isPrimarySortOrderAsc:(fields[i].Name.toLowerCase()==this.primarySortField)?this.primarySortOrder=='asc':null} ];
                            fieldMap[fields[i].Name] = fields[i];
                        }
                        this.queryHeadings = headings;
                    }

                    results = this.transformData(fields, data.Rows);

                    //console.log('results: ' + JSON.stringify(results));

                    this.queryResults = results;
                    // Process field linkability
                    for(var i=0; i<this.queryResults.length; i++){

                        for(var j=0; j<this.queryResults[i].Fields.length; j++){

                            if (this.fieldArrayLowercase[this.queryResults[i].Fields[j].Name.toLowerCase()]?.Linkable !== undefined) {
                                this.queryResults[i].Fields[j].Linkable = this.fieldArrayLowercase[this.queryResults[i].Fields[j].Name.toLowerCase()].Linkable;
                                if (this.queryResults[i].Fields[j].Linkable && this.queryResults[i].Fields[j].Value !== undefined && this.queryResults[i].Fields[j].Value !== null && this.queryResults[i].Fields[j].Value.length > 0) {
                                    this.queryResults[i].Fields[j].HRef = this.orgDomainUrl + this.queryResults[i].Fields[j].Value;
                                }
                            }
                        }
                    }  
                }               

                // remove the query from the array
                if(this.querySave.includes(this.soqlQuery)){
                    this.querySave = this.querySave.filter(e => e !== this.soqlQuery);
                }
                // Add the query to the end of the array
                this.querySave = [ ...this.querySave, this.soqlQuery ];
                this.querySavePosition = this.querySave.length;

                this.pageOfData++;
                

                this.isLoading = false;
                this.error = undefined;
            
            })
            .catch(error => {
                console.error('error (submitQuery) => ', error);
                this.error = error.body.message;
                this.isLoading = false;
            })
        }
    }

    transformData(fields, results) {
        return results.map(result => {
            let data = [];
            fields.forEach(field => {
                let fieldParts = field.Name.toLowerCase().split('.');
                let value = result;
                for (let part of fieldParts) {
                    value = value ? this.getValueIgnoreCase(value, part) : null;
                }
                data.push({ Name: field.Name, Value: value });                
            });
            return { Fields: data };
        });
    }
    
    getValueIgnoreCase(obj, key) {
        let lowerCaseKey = key.toLowerCase();
        for (let k in obj) {
            if (obj.hasOwnProperty(k) && k.toLowerCase() === lowerCaseKey) {
                return obj[k];
            }
        }
        return null;
    }

    historyUp(){
        console.log('starting historyUp:' + this.querySave.length + ':' + this.querySavePosition);
        if(this.querySave.length > 0 && this.querySavePosition < this.querySave.length -1){
            this.querySavePosition++;
            this.template.querySelector('[data-id="soql_query_textarea"]').value = this.querySave[this.querySavePosition];
        }
    }

    historyDown(){
        console.log('starting historyDown:' + this.querySave.length + ':' + this.querySavePosition);
        if(this.querySave.length > 0 && this.querySavePosition > 0){
            this.querySavePosition--;
            
            if(this.querySave[this.querySavePosition] == this.template.querySelector('[data-id="soql_query_textarea"]').value){
            
                if(this.querySavePosition > 0){
                    this.querySavePosition--;
                }
            }        
            

            this.template.querySelector('[data-id="soql_query_textarea"]').value = this.querySave[this.querySavePosition];
        }
    }

    addFavourite(event){
        console.log('starting addFavourite:' + this.template.querySelector('[data-id="soql_query_textarea"]').value);
        var currentQuery = this.template.querySelector('[data-id="soql_query_textarea"]').value;
        if(currentQuery.length > 0){
            this.isLoading = true;
            addQueryToFavourites({query : currentQuery})
            .then(data => {
                console.log('Query added to favourites');
                this.isLoading = false;
                this.error = undefined;
            })
            .catch(error => {
                console.error('error (addFavourite) => ', error);
                this.error = error.body.message;
                this.isLoading = false;
            })
        }
    }

    displayFavs(){
        console.log('starting displayFavs');
        this.isDisplayFavs = true;
        this.isLoading = true;
        getUsersFavouriteQueries()
            .then(data => {
                console.log(data);
                this.usersFavouriteQueries = [];
                var temp = [];

                for (var i = 0; i < data.length; i++) {
                    temp = [ ...temp, {index: i, value: data[i].Query__c, id:data[i].Id, order:data[i].Order__c} ];
                }

                this.usersFavouriteQueries = temp;

                this.isLoading = false;
                this.error = undefined;
            })
            .catch(error => {
                console.error('error (displayFavs) => ', error);
                this.error = error.body.message;
                this.isLoading = false;
            })
    }

    chooseFav(event){
        console.log('starting chooseFav : ' + event.currentTarget.dataset.id);
        this.soqlQuery = this.usersFavouriteQueries[parseInt(event.currentTarget.dataset.id)].value;
        this.parsedSoql = this.parseSoql(this.soqlQuery);
        this.isDisplayFavs = false;
    }

    deleteFav(event){
        console.log('starting deleteFav : ' + event.currentTarget.dataset.id);
        this.isLoading = true;

        deleteFavourite({queryId : event.currentTarget.dataset.id})
            .then(data => {

                this.isLoading = false;
                this.usersFavouriteQueries = [];
                var temp = [];

                for (var i = 0; i < data.length; i++) {
                    temp = [ ...temp, {index: i, value: data[i].Query__c, id:data[i].Id, order:data[i].Order__c} ];
                }

                this.usersFavouriteQueries = temp;
                this.error = undefined;
            })
            .catch(error => {
                console.error('error (deleteFav) => ', error);
                this.error = error.body.message;
                this.isLoading = false;
            })
    }


    // Function to submit a TSV query
    submitTsvQuery(){
        console.log('starting submitTsvQuery');
        this.isLoading = true;
        this.jobStatus = null;
        this.displayQueryResults = false;

        // Get the SOQL query from the textarea
        this.soqlQuery = this.template.querySelector('[data-id="soql_query_textarea"]').value;

        this.parsedSoql = this.parseSoql(this.soqlQuery);

        submitQueryTsv({objectApiName : this.parsedSoql.objectName,
            fields : this.parsedSoql.fields,
            whereClause : this.parsedSoql.whereClauses, 
            sortOrder : this.parsedSoql.orderByClauses, 
            limitCount : this.parsedSoql.limitValue,
            allRows : this.template.querySelector('[data-id="excludeDeleted"]').checked})
        .then(data => {
            // Process TSV query results
            this.queryResults = [];
            this.totalRowCountWithNoLimit = undefined;
            this.queryHeadings = [{name:'Download CSV'}];
            const downloadLink = {};
            downloadLink.Value = 'Download';
            downloadLink.Linkable = true;
            downloadLink.IsDownloadLink = true;
            downloadLink.HRef = this.orgDomainUrl + '/sfc/servlet.shepherd/version/download/'+data+'?operationContext=S1';
            this.queryResults[0] = {};
            this.queryResults[0].RowId = 'dummy';
            this.queryResults[0].Fields = [];
            this.queryResults[0].Fields.push(downloadLink);

            this.displayQueryResults = true;
        
            this.isLoading = false;
            this.error = undefined;
        
        })
        .catch(error => {
            this.error = error.body.message;
            console.error('error (submitQueryTsv) => ', error);
            this.isLoading = false;
        })
    }

    

    submitQueryBatch(){
        console.log('starting submitQueryBatch');
        this.isLoading = true;
        this.queryHeadings = [];
        this.queryResults = [];
        this.totalRowCountWithNoLimit = undefined;
        this.displayQueryResults = false;

        this.soqlQuery = this.template.querySelector('[data-id="soql_query_textarea"]').value;

        this.parsedSoql = this.parseSoql(this.soqlQuery);

        submitQueryBatch({objectApiName : this.parsedSoql.objectName,
            fields : this.parsedSoql.fields,
            whereClause : this.parsedSoql.whereClauses, 
            sortOrder : this.parsedSoql.orderByClauses, 
            limitCount : this.parsedSoql.limitValue,
            allRows : this.template.querySelector('[data-id="excludeDeleted"]').checked})
        .then(result => {
            console.log('Result from batch job :');
            console.dir(result);
            this.batchJobId = result.jobId;
            this.contentDocumentId = result.contentDocumentId;     
            this.isLoading = false;
            this.error = undefined;
            
            this.jobStatus = {Status : 'Submitted', JobItemsProcessed : '', TotalJobItems : ''};
            this.isBatchJobCompleted = false;
            this.monitorJobProgress();
        
        })
        .catch(error => {
            this.error = error.body.message;
            console.error('error (submitQueryBatch) => ', error); // error handling
            this.isLoading = false;
        })


    }


    parseSoql(soqlString){
        console.log('starting parseSoql: ' + soqlString);
        const result = {
            objectName: '',
            fields: [],
            whereClauses: '',
            orderByClauses: '',
            limitValue: ''           
        }

        const partsLower = soqlString.replace(/\s+/g,' ').toLowerCase().split(' ');
        const parts = soqlString.replace(/\s+/g,' ').split(' ');

        // get fields
        const fromIndex = partsLower.indexOf('from');
        result.fields = soqlString.slice(soqlString.toLowerCase().indexOf('select ') + 7, soqlString.toLowerCase().indexOf(' from ')).trim().split(',').map(f => f.trim());

        // get object name
        result.objectName = partsLower[fromIndex + 1];

        //get where clauses
        const whereIndex = partsLower.indexOf('where');
        if(whereIndex !== -1){
            const orderByIndex = partsLower.indexOf('order', whereIndex);
            const limitIndex = partsLower.indexOf('limit', whereIndex);
            const whereEndIndex = orderByIndex !== -1 ? orderByIndex : limitIndex !== -1 ? limitIndex : partsLower.length;
            result.whereClauses = parts.slice(whereIndex + 1, whereEndIndex).join(' '); //Use parts instead of partsLower to get the actual case of the field values as matters to Ids
        }

        // Get order by clauses
        const orderByIndex = partsLower.indexOf('order');
        if(orderByIndex !== -1){
            const limitIndex = partsLower.indexOf('limit', orderByIndex);
            const orderByEnd = limitIndex !== -1 ? limitIndex : partsLower.length;
            result.orderByClauses = partsLower.slice(orderByIndex + 2, orderByEnd).join(' ');
        }

        this.determineSortFields(result.orderByClauses);


        // get Limit value
        const limitIndex = partsLower.indexOf('limit');
        if(limitIndex !== -1){
            result.limitValue = parseInt(partsLower[limitIndex + 1], 10);
            this.limit = result.limitValue;
        } else {
            this.limit = '';
        }        

        console.log('Parsed SOQL :' + JSON.stringify(result));
        return result;
    }



    determineSortFields(orderByClauses){
        console.log('starting determineSortFields : ' + orderByClauses);
        if(orderByClauses.length > 0){
            this.primarySortField = orderByClauses.split(' ')[0].toLowerCase();
            var firstSort = '';
            if(orderByClauses.split(',').length > 1){
                firstSort = orderByClauses.split(',')[0];
                if(firstSort.split(' ').length > 1){
                    this.primarySortOrder = firstSort.split(' ')[1];
                } else {
                    this.primarySortOrder = 'asc';
                }
            } else {
                if(orderByClauses.split(' ').length > 1){
                    this.primarySortOrder = orderByClauses.split(' ')[1];
                } else {
                    this.primarySortOrder = 'asc';
                }
            }

        } else {
            this.primarySortField = '';
            this.primarySortOrder = '';
        }

        console.log('primarySortField:' + this.primarySortField + ' primarySortOrder:' + this.primarySortOrder);
    }


    monitorJobProgress(){
        const checkStatus = setInterval(() => {
            console.log('Checking job status');
            getBatchJobStatus({jobId : this.batchJobId})
            .then(result => {
                console.log('Job status: ' + result);
                console.dir(result);
                this.jobStatus = result;
                if(this.jobStatus.Status == 'Completed'){
                    this.isBatchJobCompleted = true;
                    clearInterval(checkStatus);

                    getDownloadUrls({contentDocumentId : this.contentDocumentId})
                    .then(result => {
                        this.downloadUrls = [];
                        this.downloadUrls = result;

                        this.isLoading = false;
                        this.error = undefined;
                    })
                }
            })
            .catch(error => {
                this.error = error.body.message;
                console.error('error (monitorJobProgress) => ', error); // error handling
                clearInterval(checkStatus);
                this.isLoading = false;
            })
        }, 5000);
    }




    fieldChanged(event){
        console.log('starting fieldChanged');
        this.isLoading = true;
        var fields = this.template.querySelector('[data-id="fieldSelect"]')

        var selectedFields = Array.from(fields.selectedOptions).map(option => option.value);

        if(selectedFields.length > 1){
            if(selectedFields[0] == 'count()'){
                for(let i = 1; i < fields.options.length; i++) {
                    fields.options[i].selected = false;
                }
                selectedFields = [];
                selectedFields = [ ...selectedFields, 'count()' ];
            } 
        } 

        this.selectedFields=selectedFields;
        console.log(this.selectedFields);
        this.rebuildQuery();
    }
    


    orderChanged(event){
        console.log('starting orderChanged');
        this.isLoading = true;
          
        this.sortOrder = '';
        var sortField = this.template.querySelector('[data-id="QB_orderby_field"]');
        if(sortField.value != ''){
            this.sortOrder = sortField.value;
            var sortDir = this.template.querySelector('[data-id="QB_orderby_sort"]');
            if(sortDir != '')
            {
                this.sortOrder += ' ' + sortDir.value;
            }

            var sortNulls = this.template.querySelector('[data-id="QB_nulls"]');
            if(sortNulls.value == 'LAST'){  
                this.sortOrder += ' NULLS LAST';
            } else {
                this.sortOrder += ' NULLS FIRST';
            }
        }
        this.rebuildQuery();
    }


    limitChanged(event){
        console.log('starting limitChanged');
        this.isLoading = true;
        console.log(this.template.querySelector('[data-id="QB_limit_txt"]').value);
        if(this.template.querySelector('[data-id="QB_limit_txt"]').value != ''){
            this.limit = this.template.querySelector('[data-id="QB_limit_txt"]').value;
        } else {
            this.limit = '';
        }
        console.log(this.limit);
        this.rebuildQuery();
    }

    filterChanged(event){
        console.log('starting filterChanged');
        this.isLoading = true;

        const startTime = Date.now();
        console.log('starting filterChanged at ' + startTime);
        this.whereClause = '';

        // imcrement the variable i by 1 & look for the next element with the id of QB_filter_field_i
        // if it exists, get the value and add it to the query
        // if it doesn't exist, break the loop
        
        for (var i = 0; i < 99; i++) {
            var whereFields = this.template.querySelector('[data-id="QB_filter_field_'+i+'"]')
            var whereOper = this.template.querySelector('[data-id="QB_filter_compOper_'+i+'"]')
            if (whereFields && whereOper) {
                
                console.log('Inside IF clause at ' + Date.now() + ' (elapsed ' + (Date.now() - startTime) + 'ms)');

                var whereFieldValue = whereFields.options[whereFields.selectedIndex].value;
                console.log('after whereFieldValue ' + whereFieldValue + ' - ' + Date.now() + ' (elapsed ' + (Date.now() - startTime) + 'ms)');

                var whereOperValue = whereOper.options[whereOper.selectedIndex].value;
                var whereOperValue2 = whereOperValue;
                if(whereOperValue == 'starts' || whereOperValue == 'ends' || whereOperValue == 'contains'){
                    whereOperValue2 = 'LIKE';
                } 
                console.log('after whereOperValue ' + whereOperValue + ' - ' + Date.now() + ' (elapsed ' + (Date.now() - startTime) + 'ms)');
                
                if (whereFieldValue != '') {

                    if (this.whereClause != '') {
                        this.whereClause += ' AND ';
                    }
                    
                    this.whereClause += whereFieldValue + ' ' + whereOperValue2;
                    if(this.template.querySelector('[data-id="QB_filter_value_'+i+'"]').value == 'null'){
                        this.whereClause += ' ' + this.template.querySelector('[data-id="QB_filter_value_'+i+'"]').value;
                    } else {
                        if(this.fieldArrayLowercase[whereFieldValue.toLowerCase()].ValueBoundByQuotes == false){
                            this.whereClause += ' ' + this.template.querySelector('[data-id="QB_filter_value_'+i+'"]').value;
                        } else {
                            if (whereOperValue == 'starts'){
                                this.whereClause += ' \'' + this.template.querySelector('[data-id="QB_filter_value_'+i+'"]').value + '%\'';
                            } else if (whereOperValue == 'ends'){
                                this.whereClause += ' \'%' + this.template.querySelector('[data-id="QB_filter_value_'+i+'"]').value + '\'';
                            } else if (whereOperValue == 'contains'){
                                this.whereClause += ' \'%' + this.template.querySelector('[data-id="QB_filter_value_'+i+'"]').value + '%\'';
                            } else {
                                this.whereClause += ' \'' + this.template.querySelector('[data-id="QB_filter_value_'+i+'"]').value + '\'';
                            }
                        }
                    }
                    console.log('after concatenating whereClause ' + Date.now() + ' (elapsed ' + (Date.now() - startTime) + 'ms)');
                } 
            } else {
                break;
            }

        }
        this.rebuildQuery();
    }

    rebuildQuery(event){
        console.log('starting rebuildQuery');        

        var tempSoql = 'SELECT ' + this.selectedFields.join(', ') + ' FROM ' + this.objectValue;
        if (this.whereClause != '') {
            tempSoql += ' WHERE ' + this.whereClause;
        }
        if(this.sortOrder != ''){
            tempSoql += ' ORDER BY ' + this.sortOrder;
        }
        if(this.limit != ''){
            tempSoql += ' LIMIT ' + this.limit;
        }
        this.soqlQuery = tempSoql;
        console.log(this.soqlQuery);

        this.template.querySelector('[data-id="soql_query_textarea"]').value = this.soqlQuery;

        this.isLoading = false;
    }

    displaySingleRow(event){
        console.log('starting displaySingleRow');
        this.isLoading = true;
        this.isDisplaySingleId = true;
        this.selectedSingleRecordId = event.target.dataset.id;
        this.chainOfSingleRowIds.push(this.selectedSingleRecordId);
        
        this.getSingleEntryData(this.selectedSingleRecordId);
    }

    goBack(event){
        console.log('starting goBack');

        
        this.error = undefined;
        this.isDisplayFavs = false;


        // remove the last element from the chainOfSingleRowIds array
        this.chainOfSingleRowIds.pop();

        // If some still on the array then display the last one
        if(this.chainOfSingleRowIds.length > 0){
            this.isLoading = true;
            this.selectedSingleRecordId = this.chainOfSingleRowIds[this.chainOfSingleRowIds.length-1];
            this.getSingleEntryData(this.selectedSingleRecordId);
        } else {
            // Gone back through all the ones displayed so return to query view
            this.isDisplaySingleId = false;
            this.isInsertView = false;
        }
    }


    resyncSoqlFields(){
        console.log('starting resyncSoqlFields');

        this.isLoading = true;
        
        this.soqlQuery = this.template.querySelector('[data-id="soql_query_textarea"]').value;
        this.parsedSoql = this.parseSoql(this.soqlQuery);
        const parsedObjValueLowercase = this.parsedSoql.objectName.toLowerCase();

        console.log('Object comparision ' + parsedObjValueLowercase + ':' + this.objectValue);

        if(parsedObjValueLowercase.toLowerCase() !== this.objectValue.toLowerCase()){

            alert('Not implemented yet when objects differ');
            //this.resyncObject(parsedObjValueLowercase);
            this.isLoading = false;
        } else {

            console.log('Object not changed so just update fields and where options : ' + this.isLoading);

            var selectedFieldsCaseInsensitive = this.parsedSoql.fields.map(f => f.toLowerCase());

            const fldSelect = this.template.querySelector('[data-id="fieldSelect"]');
            for(let i=0; i<fldSelect.options.length; i++){
                // check if selectedFieldsCaseInsensitive contains the value of the option in lower case
                if(selectedFieldsCaseInsensitive.includes(fldSelect.options[i].value.toLowerCase())){
                    fldSelect.options[i].selected = true;
                } else {
                    fldSelect.options[i].selected = false;
                }
            }
            this.isLoading = false;
        }
    }

    resyncSoqlObject(){

        console.log('starting resyncSoqlObject');
        this.soqlQuery = this.template.querySelector('[data-id="soql_query_textarea"]').value;
        this.parsedSoql = this.parseSoql(this.soqlQuery);
        const parsedObjValueLowercase = this.parsedSoql.objectName.toLowerCase();

        console.log('parsedObjValueLowercase:' + parsedObjValueLowercase);

        var tempObjectOptions = [];
        for(let i=0; i<this.objectOptions.length; i++){
            
            if(this.objectOptions[i].value.toLowerCase() === parsedObjValueLowercase){
                console.log('Object found in objectOptions');
                tempObjectOptions = [...tempObjectOptions, {label: this.objectOptions[i].label, value: this.objectOptions[i].value, selected: true}];
                this.objectValue = this.objectOptions[i].value;
            } else {
                tempObjectOptions = [...tempObjectOptions, {label: this.objectOptions[i].label, value: this.objectOptions[i].value, selected: false}];
            }
        }

        // force rerender of the object select dropdown
        this.objectOptions = [];
        this.objectOptions = [...tempObjectOptions];

        for(let i=0; i<this.objectOptions.length; i++){
            if(this.objectOptions[i].selected){
                console.log('Selected object is ' + this.objectOptions[i].value);
            }
        }

        this.getFields(false);

    }


    getSingleEntryData(recordId){

        console.log('starting getSingleEntryData');

        this.isUpdateView = false;
        this.isDeleted = false;
        this.error = undefined;
        getSingleEntryData({selectedId : recordId})
        .then(data => {
            this.rowData = [];
            this.selectedSingleRecordObject = data.ObjectApiName;

            this.rowData = data.Fields;

            // Check if data.Fields contains iSDeleted field & if it does set this.isDeleted to true so that the undelete button appears
            for(var i=0; i<this.rowData.length; i++){
                if(this.rowData[i].Name == 'IsDeleted'){
                    if(this.rowData[i].Value.toLowerCase() == 'true'){                        
                        this.isDeleted = true;
                    }   
                    break;
                }
            }


            this.isLoading = false;
            this.error = undefined;
        
        })
        .catch(error => {
            this.error = error.body.message;
            console.error('error (displaySingleRow) => ', error); // error handling
            this.isLoading = false;
        })
    }

    displayUpdateView(event){
        console.log('starting displayUpdateView');
        this.isLoading = true;
        this.isUpdateView = true;
        this.isLoading = false;
    }

    updateRow(event){
        console.log('starting updateRow');
        this.isLoading = true;
        // Get all the document elements with the name of 'updateField' and loop through them
        // For each element, get the value and add it to the rowData array
        var updateFields = this.template.querySelectorAll('[data-id="updateField"]');
        for (var i = 0; i < updateFields.length; i++) {
            var updateField = updateFields[i];
            var updateFieldName = updateField.dataset.fieldname;
            var updateFieldValue = updateField.value;
            // loop through rowData array & find element where the property name is the same as the updateFieldName
            for(var j=0; j<this.rowData.length; j++){
                if(this.rowData[j].Name == updateFieldName){
                    this.rowData[j].Value = updateFieldValue;
                    break;
                }                    
            }

        }

        //create a variable called parm which has 2 properties called ObjectApiName & Fields
        // Set these properties to have the values of this.selectedSingleRecordObject & this.rowData respectively
        var parm = {
            ObjectApiName : this.selectedSingleRecordObject,
            Fields : this.rowData
        };

        const parmJson = JSON.stringify(parm);

        updateSingleEntryData({querySingleRowJson : parmJson})
        .then(data => {
            this.error = undefined;
            this.chainOfSingleRowIds = [];
            this.isUpdateView = false;
            this.isDisplaySingleId = false;
            this.jumpToTop();
            this.isLoading = false;
        
        })
        .catch(error => {
            console.error('error (updateView) => ', error); // error handling
            if(error.body && error.body.fieldErrors){
                const fieldErrors = error.body.fieldErrors;
                this.error = '';
                for (let field in fieldErrors) {
                    if (fieldErrors.hasOwnProperty(field)) {
                        const errors = fieldErrors[field];
                        if (Array.isArray(errors) && errors.length > 0) {
                            errors.forEach(err => {
                                if (err.message) {
                                    this.error = this.error + err.message + '\n';
                                }
                            });
                        }
                    }
                }                
            
            } 
            
            if(error.body && error.body.pageErrors){
                if (Array.isArray(error.body.pageErrors) && error.body.pageErrors.length > 0) {
                    error.body.pageErrors.forEach(err => {
                        if (err.message) {
                            this.error = this.error + err.message + '\n';
                        }
                    });
                }
            } else if(error.body && error.body.message){
                this.error = this.error + error.body.message;
            } else {
                this.error = this.error + 'Error occurred.  See console log for more details';
            }
            this.isLoading = false;
        })
    }
    

    displayNewRowForInsert(event){
        console.log('starting displayNewRowForInsert');
        this.isLoading = true;
        this.error = undefined;
        this.isInsertView = true;
        // set this.fieldArrayCaseSensitive property Value to have the value of DefaultValue if it exists
        for(var i=0; i<this.fieldArrayCaseSensitive.length; i++){
            if(this.fieldArrayCaseSensitive[i].DefaultValue != undefined){
                this.fieldArrayCaseSensitive[i].Value = this.fieldArrayCaseSensitive[i].DefaultValue;
            } else {
                this.fieldArrayCaseSensitive[i].Value = '';
            }
        }
        this.isLoading = false;

    }

    insertRow(event){
        console.log('starting insertRow');
        this.isLoading = true;
        var insertedData = [];
        
        // Set the Value to the DefaultValues for a straight insert.  Required as Clone can populate Value so need to reset.
        for(var i=0; i<this.fieldArrayCaseSensitive.length; i++){
            if(this.template.querySelector('[data-id="'+this.fieldArrayCaseSensitive[i].Name+'"]')){ // required as Id is not included on the insert fields
                if(this.template.querySelector('[data-id="'+this.fieldArrayCaseSensitive[i].Name+'"]').value != ''){
                    var temp = {};
                    temp.Name = this.fieldArrayCaseSensitive[i].Name;
                    temp.Value = this.template.querySelector('[data-id="'+this.fieldArrayCaseSensitive[i].Name+'"]').value;
                    temp.Type = this.fieldArrayCaseSensitive[i].Type;
                    insertedData.push(temp);
                }
            }
        }

        var parm = {
            ObjectApiName : this.objectValue,
            Fields : insertedData
        };

        const parmJson = JSON.stringify(parm);

            
        insertSingleEntryData({querySingleRowJson : parmJson})
        .then(data => {
            this.error = undefined;
            this.isInsertView = false;
            this.isUpdateView = false;
            this.isDisplaySingleId = false;
            this.jumpToTop();
            this.chainOfSingleRowIds = []; // remove 'back' history as could have come from a Clone record 
            this.isLoading = false;
        })
        .catch(error => {
            console.error('error (insertSingleEntryData) => ', error); // error handling
            if(error.body && error.body.fieldErrors){
                const fieldErrors = error.body.fieldErrors;
                this.error = '';
                for (let field in fieldErrors) {
                    if (fieldErrors.hasOwnProperty(field)) {
                        const errors = fieldErrors[field];
                        if (Array.isArray(errors) && errors.length > 0) {
                            errors.forEach(err => {
                                if (err.message) {
                                    this.error = this.error + err.message + '\n';
                                }
                            });
                        }
                    }
                }                
            }             
                
            if(error.body && error.body.pageErrors){
                if (Array.isArray(error.body.pageErrors) && error.body.pageErrors.length > 0) {
                    error.body.pageErrors.forEach(err => {
                        if (err.message) {
                            this.error = this.error + err.message + '\n';
                        }
                    });
                }
            } else if(error.body && error.body.message){
                this.error = this.error + error.body.message;
            } else {
                this.error = this.error + 'Error occurred.  See console log for more details';
            }

            this.isLoading = false;
        })
        
    }

    cloneRow(event){
        console.log('starting cloneRow');
        this.isLoading = true;
        this.error = undefined;

        for(var i=0; i<this.fieldArrayCaseSensitive.length; i++){
            if(this.fieldArrayCaseSensitive[i].Updatable){
                for(var j=0; j<this.rowData.length; j++){
                    if(this.rowData[j].Name == this.fieldArrayCaseSensitive[i].Name){
                        this.fieldArrayCaseSensitive[i].Value = this.rowData[j].Value;
                        break;
                    }
                }
            }
        } 

        this.isDisplaySingleId = false;
        this.isInsertView = true;       
        this.isLoading = false;

    }


    deleteRow(event){
        console.log('starting deleteRow');
        

        areYouSure.open ({
            label: 'Are You Sure',
            description: 'confirm deletion',
            size: 'small',
            message: 'Are you sure you want to delete id: ' + this.selectedSingleRecordId  +'?'
        }).then((result) => {

            if(result){
                this.isLoading = true;

                deleteEntry({selectedId : this.selectedSingleRecordId})
                .then(data => {
                    this.error = undefined;
                    this.isDisplaySingleId = false;
                    this.isLoading = false
                })
                .catch(error => {
                    if(error.body.fieldErrors.Name){
                        this.error = error.body.fieldErrors.Name[0].message;
                    } else {
                        this.error = 'Error occurred.  See console log for details';
                    }
                    console.error('error (deleteRow) => ', error); // error handling
                    this.isLoading = false

                })
            }
            
            
        });
    }    
    

    undeleteRow(event){
        console.log('starting undeleteRow');
        this.isLoading = true;

        undeleteEntry({selectedId : this.selectedSingleRecordId})
        .then(data => {
            this.error = undefined;
            this.isDisplaySingleId = false;
            this.isLoading = false;
        })
        .catch(error => {
            if(error.body.fieldErrors.Name){
                this.error = error.body.fieldErrors.Name[0].message;
            } else {
                this.error = 'Error occurred.  See console log for details';
            }
            console.error('error (undeleteRow) => ', error); // error handling
            this.isLoading = false;
        })
    }


    closeInfo(event){
        console.log('starting closeInfo');
        this.hideInfoDiv = true;
    }

    toggleShowFieldLabels(event){
        console.log('starting toggleShowFieldLabels');
        this.isShowFieldLabels = !this.isShowFieldLabels;
        // Force update of rowData
        const tempRowData = this.rowData;
        this.rowData = [];
        this.rowData = tempRowData;
    }    

    toggleShowObjectLabels(event){
        console.log('starting toggleShowObjectLabels');
        this.isShowObjectLabels = !this.isShowObjectLabels;
        var returnOpts = [];
        returnOpts = [ ...returnOpts, {label: '--None--', value: ''} ];
        for (var i = 0; i < this.allObjects.length; i++) {
            if( this.isShowObjectLabels){
                returnOpts = [ ...returnOpts, {label: this.allObjects[i].Label + ' (' + this.allObjects[i].ApiName + ')', value: this.allObjects[i].ApiName} ];
            } else {
                returnOpts = [ ...returnOpts, {label: this.allObjects[i].ApiName, value: this.allObjects[i].ApiName} ];
            }
        }
        // sort returnOpts by label
        returnOpts.sort((a, b) => (a.label > b.label) ? 1 : -1);
        this.objectOptions = returnOpts;

    }


    loadPreviousPageOfData(event){
        console.log('starting loadPreviousPageOfData');
        this.pageOfData--;
        this.loadPageOfData();
    }


    loadNextPageOfData(event){
        console.log('starting loadNextPageOfData');
        this.pageOfData++;
        this.loadPageOfData();
    }


    loadPageOfData(){
        console.log('starting loadPageOfData');
        this.isLoading = true;
        this.jobStatus = null;

        const offset = (this.pageOfData-1)*this.limit;
        // Submit a regular SOQL query
        submitQuery({objectApiName : this.parsedSoql.objectName,
            fields : this.parsedSoql.fields,
            whereClause : this.parsedSoql.whereClauses, 
            sortOrder : this.parsedSoql.orderByClauses, 
            limitCount : this.parsedSoql.limitValue,
            allRows : this.template.querySelector('[data-id="excludeDeleted"]').checked,
            offset : offset})
        .then(data => {
            console.log(data);
            // Process query results
            this.queryHeadings = [];
            this.queryResults = [];
            var results = [];
            var fields = [];
            this.totalRowCountWithNoLimit = data.TotalRowCountWithNoLimit;
            fields = data.Fields;
            var fieldMap = {};

            // Need to reset the primarySortField & primarySortOrder as the query results may be in a different order
            // if the user has clicked on a heading.
            this.determineSortFields(this.parsedSoql.orderByClauses);

            var headings = [];

            // Only display data is it exists
            if (fields != null){

                if(fields.length>0){
                    for (var i = 0; i < fields.length; i++) {
                        headings = [ ...headings, {name:fields[i].Name, isPrimarySort:fields[i].Name.toLowerCase()==this.primarySortField, isPrimarySortOrderAsc:(fields[i].Name.toLowerCase()==this.primarySortField)?this.primarySortOrder=='asc':null} ];
                        fieldMap[fields[i].Name] = fields[i];
                    }
                    this.queryHeadings = headings;
                }

                results = this.transformData(fields, data.Rows);

                //console.log('results: ' + JSON.stringify(results));

                this.queryResults = results;
                // Process field linkability
                for(var i=0; i<this.queryResults.length; i++){

                    for(var j=0; j<this.queryResults[i].Fields.length; j++){

                        if (this.fieldArrayLowercase[this.queryResults[i].Fields[j].Name.toLowerCase()]?.Linkable !== undefined) {
                            this.queryResults[i].Fields[j].Linkable = this.fieldArrayLowercase[this.queryResults[i].Fields[j].Name.toLowerCase()].Linkable;
                            if (this.queryResults[i].Fields[j].Linkable && this.queryResults[i].Fields[j].Value !== undefined && this.queryResults[i].Fields[j].Value !== null && this.queryResults[i].Fields[j].Value.length > 0) {
                                this.queryResults[i].Fields[j].HRef = this.orgDomainUrl + this.queryResults[i].Fields[j].Value;
                            }
                        }
                    }
                }  
            }              

            this.isLoading = false;
            this.error = undefined;
        
        })
        .catch(error => {
            console.error('error (loadPageOfData) => ', error);
            this.error = error.body.message;
            this.isLoading = false;
        })

    }


    queryHeadingClick(event) {
        const clickedHeading = event.currentTarget.dataset.heading;
        console.log('queryHeadingClick:', clickedHeading);
        this.isLoading = true;

        if(clickedHeading.toLowerCase() == this.primarySortField){
            if(this.primarySortOrder == 'asc'){
                this.primarySortOrder = 'desc';
            } else {
                this.primarySortOrder = 'asc';
            }
        } else {
            this.primarySortField = clickedHeading.toLowerCase();
            this.primarySortOrder = 'asc';
        }

        var headings = [];
        for(let i=0; i<this.queryHeadings.length; i++){
            headings = [ ...headings, {name:this.queryHeadings[i].name, isPrimarySort:this.queryHeadings[i].name.toLowerCase()==this.primarySortField, isPrimarySortOrderAsc:(this.queryHeadings[i].name.toLowerCase()==this.primarySortField)?this.primarySortOrder=='asc':null} ];
        }

        // Force reactivity
        this.queryHeadings = [...headings];

        this.sortData();
        
        this.isLoading = false;
    }


    sortData(){
        // sort the queryResults array by the primarySortField & primarySortOrder
        console.log('starting sortData');

        this.queryResults.sort((a, b) => {
            var aValue = '';
            var bValue = '';
            for(var i=0; i<a.Fields.length; i++){
                if(a.Fields[i].Name.toLowerCase() == this.primarySortField){
                    aValue = a.Fields[i].Value;
                    break;
                }
            }
            for(var i=0; i<b.Fields.length; i++){
                if(b.Fields[i].Name.toLowerCase() == this.primarySortField){
                    bValue = b.Fields[i].Value;
                    break;
                }
            }

            if(aValue < bValue){
                return this.primarySortOrder == 'asc' ? -1 : 1;
            }
            if(aValue > bValue){
                return this.primarySortOrder == 'asc' ? 1 : -1;
            }
            return 0;
        });

        // Force reactivity
        this.queryResults = [...this.queryResults];
    }

    previewClick(event) {
        const url = event.currentTarget.dataset.id;
        window.open(url, '_blank');
    }

    jumpToTop() {
        console.log('starting jumpToTop');
        window.scrollTo({
            top: 0,
            behavior: 'auto'
        });
        console.log('ending jumpToTop');
    }

    /*datetimeChange(){

        
        console.log('starting datetimeChange');
        this.isLoading = true;

        this.convertDateTime = this.template.querySelector('[data-id="datetimeIn"]').value.replace('T', ' ');

        const [datePart, timePart] = this.convertDateTime.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hour, minute, second] = timePart.split(':');

        if(this.template.querySelector('[data-id="localToUtc"]')){
            const localToUtc = this.template.querySelector('[data-id="localToUtc"]').checked;
            var fromTz = 'UTC';
            var toTz = this.usersTimezone;
            if(localToUtc){
                fromTz = this.usersTimezone;
                toTz = 'UTC';
            }

            convertTimeZone({datetimeStr : year+'-'+month+'-'+day+' '+hour+':'+minute+':'+(second===undefined?'00':second),
                fromTz : fromTz,
                toTz : toTz

            })
            .then(data => {
                var returnedDatetime = data + '';
                this.error = undefined;
                var convertedDatetimeId = this.template.querySelector('[data-id="convertedDatetimeId"]');
                convertedDatetimeId.innerHTML = returnedDatetime;
                this.isLoading = false;
            })
            .catch(error => {
                if(error.body.message){
                    this.error = error.body.message;
                } else {
                    this.error = 'Error occurred.  See console log for details';
                }
                console.error('error (convertTimeZone) => ', error); // error handling
                this.isLoading = false;
            })
        }
    }*/

    

    zombieEasterEgg() {

        andeeZombie.open ({
            label: 'Zombie',
            description: 'Play a game of zombies, try to survive the apocalypse',
            size: 'small'
        }).then((result) => {
            
        });
    }

    quotesEasterEgg(){  
        console.log('starting quotesEasterEgg');
        this.isQuotesGame = true;
        const quotesComponent = this.template.querySelector('c-andee-quotes');
        if (quotesComponent) {
            quotesComponent.classList.remove('slds-hide');
        }

    }

    handleCloseQuotes(event) {
        console.log('starting handleCloseQuotes');
        this.isQuotesGame = !event.detail.isClosed;
    }


    handleFavDragStart(event) {
        console.log('starting handleFavDragStart');
        event.dataTransfer.setData('text/plain', event.target.dataset.id);
    }

    handleFavDragOver(event) {
        event.preventDefault();
    }

    handleFavDrop(event) {
        console.log('starting handleFavDrop');
        event.preventDefault();
        const draggedItemId = event.dataTransfer.getData('text/plain');
        const droppedItemId = event.target.dataset.id;

        if (draggedItemId !== droppedItemId) {
            this.reorderFavItems(draggedItemId, droppedItemId);
        }
    }

    reorderFavItems(draggedItemId, droppedItemId) {
        console.log('starting reorderFavItems');
        const draggedIndex = this.usersFavouriteQueries.findIndex(item => item.index == draggedItemId);
        const droppedIndex = this.usersFavouriteQueries.findIndex(item => item.index == droppedItemId);

        const [draggedItem] = this.usersFavouriteQueries.splice(draggedIndex, 1);

        this.usersFavouriteQueries.splice(droppedIndex, 0, draggedItem);

        var tempFavQueries = [];
        for(let i=0; i<this.usersFavouriteQueries.length; i++){
            if(i+1 != this.usersFavouriteQueries[i].order){
                tempFavQueries = [...tempFavQueries, {Id: this.usersFavouriteQueries[i].id, Query__c: this.usersFavouriteQueries[i].value, Order__c: i+1}];
                this.usersFavouriteQueries[i].order = i+1;
            }
        }

        console.log(tempFavQueries);

        if(tempFavQueries.length > 0){
            this.isLoading = true;
            reorderFavouriteQueries({favouriteQueries : tempFavQueries})
            .then(data => {
                console.log('Favourites reordered');
                this.isLoading = false;
                this.error = undefined;
            })
            .catch(error => {
                console.error('error (reorderFavItems) => ', error);
                this.error = error.body.message;
                this.isLoading = false;
            })
        }



    }


    get isQueryMode() {
        return !this.isDisplaySingleId && !this.isInsertView && !this.isDisplayFavs;
    }

    get queryMainDivClass() {
        return this.isQueryMode?'':'slds-hide';
    }

    get insertButtonLabel() {
        return this.objectValue ? 'Insert ' + this.objectValue : 'Insert';
    }

    get styledRowData() {
        return this.rowData.map(record => ({
            ...record,
            nameStyle: `color: ${record.Nillable ? 'black' : 'red'}; 
                        font-weight: ${record.Updatable ? 'bold' : 'normal'};`
        }));
    }

    get styledFieldArrayCaseSensitive() {
        return this.fieldArrayCaseSensitive.map(record => ({
            ...record,
            nameStyle: `color: ${record.Nillable || record.HasDefaultOnCreate? 'black' : 'red'};`
        }));
    }

    get historyUpDisabled() {
        return this.querySavePosition < this.querySave.length - 1 ? false : true;
    }

    get historyDownDisabled() {
        return this.querySavePosition > 0 && this.querySave.length > 1 ? false : true;
    }

    get querySaveDisplayPosition() {
        if(this.querySavePosition>=this.querySave.length){
            return this.querySave.length
        } else {
            return this.querySavePosition + 1;
        }
    }

    get querySaveTotal() {
        return this.querySave.length;
    }

    get moreDataToShow() {
        return ((this.pageOfData-1) * this.limit) + this.queryResults.length < Math.min(this.totalRowCountWithNoLimit, 2001); // 2000 is the maximum allowed offset
    }

    get prevDataToShow() {
        return this.pageOfData > 1;
    }

    get displayOffsetDetails() {
        return this.queryResults.length < this.totalRowCountWithNoLimit;
    }

    get displayStartingDataRowNumber() {
        return ((this.pageOfData-1) * this.limit) + 1;
    }

    get displayLastDataRowNumber() {
        return Math.min((this.pageOfData * this.limit), this.totalRowCountWithNoLimit);
    }

    get mainDivClass() {
        if(this.isSandbox){
            return 'slds-card-wrapper';
        } else {
            return 'slds-card-wrapper background-prod';
        }
    }

    get selectedSingleRecordIdHref() {
        return this.orgDomainUrl + this.selectedSingleRecordId;
    }

    /*get isPrimarySortField() {
        console.log('starting isPrimarySortField : ' + this.qh + ' : ' + this.primarySortField);
        return this.qh === this.primarySortField;
    }*/


}