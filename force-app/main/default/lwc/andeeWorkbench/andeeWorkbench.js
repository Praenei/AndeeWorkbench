import { LightningElement, wire, track } from 'lwc';

import getAllObjects from '@salesforce/apex/AndeeWorkbenchController.GetAllObjects';
import getFieldsForObject from '@salesforce/apex/AndeeWorkbenchController.GetFieldsForObject';
import submitQuery from '@salesforce/apex/AndeeWorkbenchController.SubmitQuery';
import submitQueryTsv from '@salesforce/apex/AndeeWorkbenchController.SubmitQueryTsv';
import submitQueryBatch from '@salesforce/apex/BatchAndeeWorkbench.SubmitQueryBatch';
import getBatchJobStatus from '@salesforce/apex/BatchAndeeWorkbench.GetBatchJobStatus';
import getOrgDomainUrl from '@salesforce/apex/AndeeWorkbenchController.GetOrgDomainUrl';
import getSingleEntryData from '@salesforce/apex/AndeeWorkbenchController.GetSingleEntryData';
import updateSingleEntryData from '@salesforce/apex/AndeeWorkbenchController.UpdateSingleEntryData';

export default class AndeeWorkbench extends LightningElement {    

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
    @track contentVersionUrl;
    @track isBatchJobCompleted;;
    @track isDisplaySingleId;
    @track selectedSingleRecordId;
    @track selectedSingleRecordObject;
    @track rowData = [];
    @track isUpdateView = false;

    fieldArray = [];

    fields = [];
    whereClause = ""; 
    sortOrder = "";
    limit = "200";

    orgDomainUrl = "";
    count = false;

    chainOfSingleRowIds = [];


    // When component is initialised i.e. Aura's doInit.
    connectedCallback() { 

        getOrgDomainUrl()
        .then(result => {
            this.orgDomainUrl = result;
        })
        .catch(error => {
            window.console.log('error (connectedCallback) =====> '+JSON.stringify(error));
            if(error) {
                this.error = error.body.message;
                window.console.log('@@@@ ERROR '+ error);
            }
        })

    }


    @wire(getAllObjects)
    wiredAllObjects({ error, data }) {
        if (data) {
            var returnOpts = [];
            var allValues = data;
            for (var i = 0; i < allValues.length; i++) {
                returnOpts = [ ...returnOpts, {label: allValues[i], value: allValues[i]} ];
            }

            this.objectOptions = returnOpts; 
            this.isLoading = false;

        } else if (error) {
            this.error = error.body.message;
            console.error('error (wiredAllObjects) => ', error); // error handling
            this.isLoading = false;
        }
    }


    getFields(){
        
        getFieldsForObject({objectName : this.objectValue})
        .then(data => {
            var returnOpts = [];
            var whereOpts = [];
            this.fieldArray = [];
            //returnOpts = [ ...returnOpts, {label: 'count()', value: 'count()'} ];
            var allValues = data;
            for (var i = 0; i < allValues.length; i++) {
                returnOpts = [ ...returnOpts, {label: allValues[i].Name, value: allValues[i].Name} ];
                if(allValues[i].Filterable){
                    whereOpts = [ ...whereOpts, {label: allValues[i].Name, value: allValues[i].Name} ];
                }
                this.fieldArray[allValues[i].Name.toLowerCase()]=allValues[i];
            }

            this.fieldOptions = returnOpts;
            this.fieldWhereOptions = whereOpts;
            this.isLoading = false;
            this.error = undefined;
            
        })
        .catch(error => {
            this.error = error.body.message;
            console.error('error (getFieldsForObject) => ', error); // error handling
            this.isLoading = false;
        })
    }



    objectChanged(event){
        console.log('starting objectChanged');
        this.isLoading = true;
        var obj = this.template.querySelector('[data-id="objectSelect"]')
        this.objectValue = obj.value;
        console.log(this.objectValue);
        this.getFields();
    }

    submitQuery(){
        console.log('starting submitQuery');
        this.isLoading = true;
        this.jobStatus = null;

        this.soqlQuery = this.template.querySelector('[data-id="soql_query_textarea"]').value;
        var upperSoql = this.soqlQuery.toUpperCase();

        console.log('soqlQuery :' +  this.soqlQuery);
        console.log('objectApiName :' +  this.objectValue);

        var fields = this.findStringBetween(this.soqlQuery, 'SELECT ', ' FROM ').split(',');
        for(var i=0; i<fields.length; i++){
            fields[i] = fields[i].trim();
        }
        console.log(fields);

        var whereClause = '';
        if(upperSoql.indexOf(' WHERE ') > -1){
            if(upperSoql.indexOf(' ORDER BY ') > -1){
                whereClause = this.findStringBetween(this.soqlQuery, ' WHERE ', ' ORDER BY ');
            } else {
                whereClause = this.findStringBetween(this.soqlQuery, ' WHERE ', ' LIMIT ');
            }
        }
        console.log(whereClause);

        var sortOrder = '';
        if(upperSoql.indexOf(' ORDER BY ') > -1){
            sortOrder = this.findStringBetween(this.soqlQuery, ' ORDER BY ', ' LIMIT ');
        }
        console.log(sortOrder);

        
        var limit = '';
        if(upperSoql.indexOf(' LIMIT ') > -1){
            limit = this.findStringBetween(this.soqlQuery, ' LIMIT ', ' ??? ');
        }
        console.log(limit);

        console.log('All rows :' + this.template.querySelector('[data-id="excludeDeleted"]').checked);
        
        if(this.count) {
            submitQueryCount({objectApiName : this.objectValue,
                whereClause : whereClause,
                allRows : this.template.querySelector('[data-id="excludeDeleted"]').checked})
                .then(data => {
                    this.queryResults = [];
                    this.queryHeadings = ['Count'];
                    fields.Value = data;
                    fields.Linkable = false;
                    this.queryResults[0] = {};
                    this.queryResults[0].RowId = 'dummy';
                    this.queryResults[0].Fields = [];
                    this.queryResults[0].Fields.push(fields);
              
                    this.isLoading = false;
                    this.error = undefined;
            
            })
            .catch(error => {
                this.error = error.body.message;
                console.error('error (submitQueryCount) => ', error); // error handling
                this.isLoading = false;
            })

        } else {
            submitQuery({objectApiName : this.objectValue,
                fields : fields,
                whereClause : whereClause, 
                sortOrder : sortOrder, 
                limitCount : limit,
                allRows : this.template.querySelector('[data-id="excludeDeleted"]').checked})
            .then(data => {
                console.log(data);
                this.queryHeadings = [];
                this.queryResults = [];
                var results = [];
                results = data;
                var headings = [];

                if(results.length>0){
                    for (var i = 0; i < results[0].Fields.length; i++) {
                        headings = [ ...headings, results[0].Fields[i].Name]  ;
                    }
                    this.queryHeadings = headings;
                }


                this.queryResults = data;

                for(var i=0; i<this.queryResults.length; i++){
                    for(var j=0; j<this.queryResults[i].Fields.length; j++){
                        if (this.fieldArray[this.queryResults[i].Fields[j].Name.toLowerCase()]?.Linkable !== undefined) {
                            this.queryResults[i].Fields[j].Linkable = this.fieldArray[this.queryResults[i].Fields[j].Name.toLowerCase()].Linkable;
                            if (this.queryResults[i].Fields[j].Linkable) {
                                this.queryResults[i].Fields[j].HRef = this.orgDomainUrl + '/' + this.queryResults[i].Fields[j].Value;
                            }
                        }
                    }
                }                
                this.isLoading = false;
                this.error = undefined;
            
            })
            .catch(error => {
                this.error = error.body.message;
                console.error('error (submitQuery) => ', error); // error handling
                this.isLoading = false;
            })
        }


    }

    

    submitTsvQuery(){
        console.log('starting submitTsvQuery');
        this.isLoading = true;
        this.jobStatus = null;

        this.soqlQuery = this.template.querySelector('[data-id="soql_query_textarea"]').value;
        var upperSoql = this.soqlQuery.toUpperCase();

        console.log('soqlQuery :' +  this.soqlQuery);
        console.log('objectApiName :' +  this.objectValue);

        var fields = this.findStringBetween(this.soqlQuery, 'SELECT ', ' FROM ').split(',');
        for(var i=0; i<fields.length; i++){
            fields[i] = fields[i].trim();
        }
        console.log(fields);

        var whereClause = '';
        if(upperSoql.indexOf(' WHERE ') > -1){
            if(upperSoql.indexOf(' ORDER BY ') > -1){
                whereClause = this.findStringBetween(this.soqlQuery, ' WHERE ', ' ORDER BY ');
            } else {
                whereClause = this.findStringBetween(this.soqlQuery, ' WHERE ', ' LIMIT ');
            }
        }
        console.log(whereClause);

        var sortOrder = '';
        if(upperSoql.indexOf(' ORDER BY ') > -1){
            sortOrder = this.findStringBetween(this.soqlQuery, ' ORDER BY ', ' LIMIT ');
        }
        console.log(sortOrder);

        
        var limit = '';
        if(upperSoql.indexOf(' LIMIT ') > -1){
            limit = this.findStringBetween(this.soqlQuery, ' LIMIT ', ' ??? ');
        }
        console.log(limit);

        console.log('All rows :' + this.template.querySelector('[data-id="excludeDeleted"]').checked);
        submitQueryTsv({objectApiName : this.objectValue,
            fields : fields,
            whereClause : whereClause, 
            sortOrder : sortOrder, 
            limitCount : limit,
            allRows : this.template.querySelector('[data-id="excludeDeleted"]').checked})
        .then(data => {
            this.queryResults = [];
            this.queryHeadings = ['Download CSV'];
            fields.Value = 'Download';
            fields.Linkable = true;
            fields.IsDownloadLink = true;
            fields.HRef = this.orgDomainUrl + '/lightning/r/ContentDocument/'+data+'/view';
            this.queryResults[0] = {};
            this.queryResults[0].RowId = 'dummy';
            this.queryResults[0].Fields = [];
            this.queryResults[0].Fields.push(fields);
        
            this.isLoading = false;
            this.error = undefined;
        
        })
        .catch(error => {
            this.error = error.body.message;
            console.error('error (submitQueryTsv) => ', error); // error handling
            this.isLoading = false;
        })


    }

    

    submitQueryBatch(){
        console.log('starting submitQueryBatch');
        this.queryResults = [];
        this.isLoading = true;

        this.soqlQuery = this.template.querySelector('[data-id="soql_query_textarea"]').value;
        var upperSoql = this.soqlQuery.toUpperCase();

        console.log('soqlQuery :' +  this.soqlQuery);
        console.log('objectApiName :' +  this.objectValue);

        var fields = this.findStringBetween(this.soqlQuery, 'SELECT ', ' FROM ').split(',');
        for(var i=0; i<fields.length; i++){
            fields[i] = fields[i].trim();
        }
        console.log(fields);

        var whereClause = '';
        if(upperSoql.indexOf(' WHERE ') > -1){
            if(upperSoql.indexOf(' ORDER BY ') > -1){
                whereClause = this.findStringBetween(this.soqlQuery, ' WHERE ', ' ORDER BY ');
            } else {
                whereClause = this.findStringBetween(this.soqlQuery, ' WHERE ', ' LIMIT ');
            }
        }
        console.log(whereClause);

        var sortOrder = '';
        if(upperSoql.indexOf(' ORDER BY ') > -1){
            sortOrder = this.findStringBetween(this.soqlQuery, ' ORDER BY ', ' LIMIT ');
        }
        console.log(sortOrder);

        
        var limit = '';
        if(upperSoql.indexOf(' LIMIT ') > -1){
            limit = this.findStringBetween(this.soqlQuery, ' LIMIT ', ' ??? ');
        }
        console.log(limit);

        console.log('All rows :' + this.template.querySelector('[data-id="excludeDeleted"]').checked);

        submitQueryBatch({objectApiName : this.objectValue,
            fields : fields,
            whereClause : whereClause, 
            sortOrder : sortOrder, 
            limitCount : limit,
            allRows : this.template.querySelector('[data-id="excludeDeleted"]').checked})
        .then(result => {
            console.log('Result from batch job :');
            console.dir(result);
            this.batchJobId = result.jobId;
            this.contentVersionUrl = this.orgDomainUrl + '/' + result.contentVersionId;      
            this.isLoading = false;
            this.error = undefined;
            this.monitorJobProgress();
        
        })
        .catch(error => {
            this.error = error.body.message;
            console.error('error (submitQueryBatch) => ', error); // error handling
            this.isLoading = false;
        })


    }

    monitorJobProgress(){
        const checkStatus = setInterval(() => {
            console.log('Checking job status');
            this.isBatchJobCompleted = false;
            getBatchJobStatus({jobId : this.batchJobId})
            .then(result => {
                console.log('Job status: ' + result);
                console.dir(result);
                this.jobStatus = result;
                if(this.jobStatus.Status == 'Completed'){
                    this.isBatchJobCompleted = true;
                    clearInterval(checkStatus);
                    this.isLoading = false;
                    this.error = undefined;
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


    addFilterRow(){
        console.log('addFilterRow');

        // Get the id of the next filter row to create
        /*var nextRow = 0;
        for(var i = 0; i < 99; i++) {
            const dataId = '[data-id="QB_filter_field_'+i + '"]';
            var filterRow = this.template.querySelector(dataId);
            console.log(i + ' : ' + filterRow);
            if(filterRow===undefined || filterRow===null){
                nextRow = i;
                break;
            }
        }

        var firstFilterRow = this.template.querySelector('[data-id="first-filter-row"]');
        var newFilterRow = firstFilterRow.innerHTML;
        newFilterRow = newFilterRow.replace('"QB_filter_field_0"', '"QB_filter_field_'+nextRow+'"');
        newFilterRow = newFilterRow.replace('"QB_filter_compOper_0"', '"QB_filter_compOper_'+nextRow+'"');
        newFilterRow = newFilterRow.replace('"QB_filter_value_0"', '"QB_filter_value_'+nextRow+'"');
        var filterTable = this.template.querySelector('[data-id="filter_rows"]');
        filterTable.innerHTML += "<tr>" + newFilterRow + "</tr>";*/



    }

    // a function that accepts a text string called str & 2 more strings called startStr & endStr
    // The function finds the first occurance of startStr in str and returns the substring from the character immediately after startStr to the start of endStr
    // If the startStr is not found then return an empty string
    // If the endStr is not found then it will go to the end of str 
    findStringBetween(str, startStr, endStr){
        var lowerStr = str.toLowerCase();
        var lowerStartStr = startStr.toLowerCase();
        var lowerEndStr = endStr.toLowerCase();

        var start = lowerStr.indexOf(lowerStartStr);
        if(start == -1){
            return '';
        } else {
            start += startStr.length;
        }

        var end = lowerStr.indexOf(lowerEndStr, start);
        if(end == -1){
            end = str.length;
        }

        return str.substring(start, end);
    }




    fieldChanged(event){
        this.isLoading = true;
        this.count = false;
        var fields = this.template.querySelector('[data-id="fieldSelect"]')

        var selectedFields = Array.from(fields.selectedOptions).map(option => option.value);

        if(selectedFields.length > 1){
            if(selectedFields[0] == 'count()'){
                for(let i = 1; i < fields.options.length; i++) {
                    fields.options[i].selected = false;
                }
                selectedFields = [];
                selectedFields = [ ...selectedFields, 'count()' ];
                this.count = true;
            } 
        } else if(selectedFields.length == 1 && selectedFields[0] == 'count()'){
            this.count = true;
        } 

        this.fields=selectedFields;
        console.log(this.fields);
        this.rebuildQuery();
    }
    


    orderChanged(event){
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
            this.limit = 200;
        }
        console.log(this.limit);
        this.rebuildQuery();
    }

    filterChanged(event){
        this.isLoading = true;

        const startTime = Date.now();
        console.log('starting filterChanged at ' + startTime);
        this.whereClause = '';

        // imcrement the variable i by 1 & look for the next element with the id of QB_filter_field_i
        // if it exists, get the value and add it to the query
        // if it doesn't exist, break the loop
        
        for (var i = 0; i < 99; i++) {
            console.log('loop ' + i + ' at ' + Date.now() + ' (elapsed ' + (Date.now() - startTime) + 'ms)');
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
                        if(this.fieldArray[whereFieldValue.toLowerCase()].Type == 'BOOLEAN' || this.fieldArray[whereFieldValue.toLowerCase()].Type == 'DATE' || this.fieldArray[whereFieldValue.toLowerCase()].Type == 'DATETIME' || this.fieldArray[whereFieldValue.toLowerCase()].Type == 'Double'){
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
        console.log('starting rebuildQuery ' + Date.now() + ' (elapsed ' + (Date.now() - startTime) + 'ms');
        this.rebuildQuery();
        console.log('post rebuildQuery ' + Date.now() + ' (elapsed ' + (Date.now() - startTime) + 'ms');
    }

    rebuildQuery(event){
        console.log('starting rebuildQuery');        

        var tempSoql = 'SELECT ' + this.fields.join(', ') + ' from ' + this.objectValue;
        if (this.whereClause != '') {
            tempSoql += ' WHERE ' + this.whereClause;
        }
        if(this.sortOrder != ''){
            tempSoql += ' ORDER BY ' + this.sortOrder;
        }
        tempSoql += ' LIMIT ' + this.limit;
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

    displayQueryView(event){
        console.log('starting displayQueryView');


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
        }
    }

    getSingleEntryData(recordId){
        this.isUpdateView = false;
        getSingleEntryData({selectedId : recordId})
        .then(data => {
            this.rowData = [];
            this.selectedSingleRecordObject = data.ObjectApiName;
            this.rowData = data.Fields;
            this.isLoading = false;
            this.error = undefined;
        
        })
        .catch(error => {
            this.error = error.body.message;
            console.error('error (displaySingleRow) => ', error); // error handling
            this.isLoading = false;
        })
    }


    updateView(event){
        console.log('starting updateView')
        
        this.isLoading = true;

        if(this.isUpdateView){

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
            
            })
            .catch(error => {
                this.error = error.body.message;
                console.error('error (updateView) => ', error); // error handling
            })

        }

        this.isUpdateView = !this.isUpdateView;
        this.isLoading = false;
    }

}
