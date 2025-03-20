public with sharing class BatchAndeeWorkbench implements Database.Batchable<sObject>, Database.Stateful {

    private string objectApiName;
    private String query;
    private list<string> fields;
    private id contentDocumentId;
    private String csvOutput = '';
    private String csvHeader;
    private integer batchNumber = 0;
    private static map<string, string> fieldTypeMap = new map<string, string>();

    /**
     * @description Constructor for BatchAndeeWorkbench
     * @param objectApiName The API name of the object to query
     * @param fields List of fields to include in the query
     * @param whereClause WHERE clause for the query
     * @param sortOrder ORDER BY clause for the query
     * @param limitCount LIMIT clause for the query
     * @param allRows Whether to include deleted records
     */
    public BatchAndeeWorkbench(String objectApiName, list<string> fields, string whereClause, string sortOrder, string limitCount, boolean allRows) {
        this.query = constructQuery(objectApiName, fields, whereClause, sortOrder, limitCount, allRows);
        this.objectApiName = objectApiName;
        this.fields = fields;

        csvHeader = String.join(fields, '\t') + '\n';

        ContentVersion cv = new ContentVersion();
        cv.Title = AndeeWorkbenchController.DOWNLOAD_CONTENT_VERSION_TITLE_PREFIX + System.currentTimeMillis();
        cv.VersionData = Blob.valueOf('Dummy');
        cv.PathOnClient = 'workBench/' + cv.Title + '.tsv';
        cv.isMajorVersion = false;

        insert cv;

        ContentVersion cvTemp = [SELECT ContentDocumentId FROM ContentVersion WHERE id = :cv.Id LIMIT 1];

        this.contentDocumentId = cvTemp.contentDocumentId;

        // Delete any contentVersions which are older that 2 days & have a pathOnClient starting with 'workBench/'
        AndeeWorkbenchController.DeleteOldDownloads();
    }

    /**
     * @description Start method for the batch process
     * @param bc The BatchableContext
     * @return Database.QueryLocator The query locator for the batch process
     */
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(query);
    }

    /**
     * @description Execute method for the batch process
     * @param bc The BatchableContext
     * @param scope The list of sObjects to process in this batch
     */
    public void execute(Database.BatchableContext bc, List<sObject> scope) {
        system.debug('execute');
        for (SObject obj : scope) {
            boolean firstField = true;
            String fileRow = '';
            for (String field : fields) {
                if (field.contains('.')) {
                    // Handle related object fields
                    List<String> relationshipParts = field.split('\\.');
                    SObject relatedObj = obj;
                    String fieldName = '';
                    Object fieldValue = null;
                    for (Integer i = 0; i < relationshipParts.size(); i++) {
                        if (relatedObj == null) break;
                        if (i == relationshipParts.size() - 1) {
                            fieldValue = relatedObj.get(relationshipParts[i]);
                            fieldName = relationshipParts[i];
                        } else {
                            relatedObj = relatedObj.getSObject(relationshipParts[i]);
                        }
                    }
                    if (!firstField) {
                        fileRow += '\t';
                    } else {
                        firstField = false;
                    }
                    String fieldType = '';
                    try {
                        fieldType = GetFieldType(relatedObj.getSObjectType().getDescribe().getName(), fieldName);
                    } catch (Exception e) {
                        fieldType = 'STRING'; // To handle things like Parent i.e. not an object
                    }
                    fileRow += (fieldValue == null) ? '' : FormatFieldValue(fieldValue, fieldType);
                } else {
                    if (!firstField) {
                        fileRow += '\t';
                    } else {
                        firstField = false;
                    }
                    // Handle fields on the main object
                    fileRow += (obj.get(field) == null) ? '' : FormatFieldValue(obj.get(field), GetFieldType(objectApiName, field));
                }
            }
            this.csvOutput += fileRow + '\n';

            if (this.csvOutput.length() > 5000000) { // Adjust size limit as needed
                saveContentVersion();
            }


        }
    }

    private void saveContentVersion() {
        system.debug('saveContentVersion');
        if (this.batchNumber == 0){
            system.debug('saveContentVersion: update');
            contentVersion cv = [select id, VersionData from ContentVersion where ContentDocumentId = :this.contentDocumentId LIMIT 1];
            cv.VersionData = Blob.valueOf(this.csvHeader + this.csvOutput);
            update cv;
        } else {
            system.debug('saveContentVersion: insert');
            ContentVersion cv = new ContentVersion();
            cv.Title = AndeeWorkbenchController.DOWNLOAD_CONTENT_VERSION_TITLE_PREFIX + System.currentTimeMillis();
            cv.VersionData = Blob.valueOf(this.csvHeader + this.csvOutput);
            cv.ContentDocumentId = this.contentDocumentId;
            cv.PathOnClient = 'workBench/' + cv.Title + '.tsv';
            cv.isMajorVersion = false;
            insert cv;
        }
        this.batchNumber ++;
        this.csvOutput = '';
    }


    /**
     * @description Finish method for the batch process
     * @param bc The BatchableContext
     */
    public void finish(Database.BatchableContext bc) {
        system.debug('finish');
        system.debug('this.csvOutput.length(): ' + this.csvOutput.length());
        if (this.csvOutput.length() > 0) { 
            saveContentVersion();
        }
    }

    /**
     * @description Submit a query for batch processing
     * @param objectApiName The API name of the object to query
     * @param fields List of fields to include in the query
     * @param whereClause WHERE clause for the query
     * @param sortOrder ORDER BY clause for the query
     * @param limitCount LIMIT clause for the query
     * @param allRows Whether to include deleted records
     * @return BatchJobResult The result of the batch job submission
     */
    @AuraEnabled
    public static BatchJobResult SubmitQueryBatch(String objectApiName, list<string> fields, string whereClause, string sortOrder, string limitCount, boolean allRows){
        BatchAndeeWorkbench job = new BatchAndeeWorkbench(objectApiName, fields, whereClause, sortOrder, limitCount, allRows);
        id jobId = Database.executeBatch(job, 200);

        system.debug('Andee: ' + jobId + ' ' + job.contentDocumentId);

        return new BatchJobResult(jobId, job.contentDocumentId);
    }

    /**
     * @description Get the status of a batch job
     * @param jobId The ID of the batch job
     * @return AsyncApexJob The status of the batch job
     */
    @AuraEnabled
    public static AsyncApexJob GetBatchJobStatus(Id jobId){
        return [SELECT Id, Status, NumberOfErrors, JobItemsProcessed, TotalJobItems FROM AsyncApexJob WHERE Id = :jobId];
    }

    /**
     * @description Construct a SOQL query string
     * @param objectApiName The API name of the object to query
     * @param fields List of fields to include in the query
     * @param whereClause WHERE clause for the query
     * @param sortOrder ORDER BY clause for the query
     * @param limitCount LIMIT clause for the query
     * @param allRows Whether to include deleted records
     * @return String The constructed SOQL query
     */
    private static string constructQuery(String objectApiName, list<string> fields, string whereClause, string sortOrder, string limitCount, boolean allRows) {
        // Build the query string
        String query = 'SELECT ' + String.join(fields, ', ') + ' FROM ' + objectApiName;
        if(whereClause != null && whereClause != ''){
            query += ' WHERE ' + whereClause;
        }
        if(sortOrder != null && sortOrder != ''){
            query += ' ORDER BY ' + sortOrder;
        } 
        if(limitCount != null && limitCount != ''){
            query += ' LIMIT ' + limitCount;
        }
        if(allRows != null && allRows){
            query += ' ALL ROWS ';
        }
        return query;
    }
    
    
    /* @method: getFieldType
     * @description:  Run a dynamic SOQL & return results
     * @param : String objectName : API object name  
     * @param : string fieldName : API field name 
     * @return : string : the type of the field e.g. String, DateTime, Boolean, etc
    */
    private static String getFieldType(string objectName, String fieldName){

        system.debug('getFieldType: ' + objectName + '.' + fieldName);

        if(fieldTypeMap.containsKey(objectName + '.' + fieldName)){
            return fieldTypeMap.get(objectName + '.' + fieldName);
        } else {
            try {
                Schema.SObjectType targetType = Schema.getGlobalDescribe().get(objectName);
                Schema.DescribeSObjectResult targetDesc = targetType.getDescribe();
                Map<String, Schema.SObjectField> fieldMap = targetDesc.fields.getMap();
                Schema.SObjectField field = fieldMap.get(fieldName);
                Schema.DescribeFieldResult fieldDesc = field.getDescribe();
                fieldTypeMap.put(objectName + '.' + fieldName, fieldDesc.getType().name());
                return fieldDesc.getType().name();
            } catch (Exception e){ // handling (badly) things like Parent.Name on account when Parent is not an object.
                return 'string';
            }
        }
    }
    

    /* @method: FormatFieldValue
     * @description:  Correct foramt a field's value depending on the field's type
     * @param : String objectName : API object name  
     * @param : string fieldName : API field name 
     * @return : string : the type of the field e.g. String, DateTime, Boolean, etc
    */
    private static string FormatFieldValue(Object fieldValue, string fieldType){
        if(fieldValue == null){
            return '';
        }

        if(fieldType == 'BOOLEAN'){
            return (Boolean)fieldValue ? 'true' : 'false';
        } else if(fieldType == 'DATE'){
            // format date as yyyy-MM-dd
            return ((Date)fieldValue).year() + '-' + (((Date)fieldValue).month()<=9?'0':'')+((Date)fieldValue).month() + '-' + (((Date)fieldValue).day()<=9?'0':'')+((Date)fieldValue).day();
            //return ((Date)fieldValue).format();
        } else if(fieldType == 'DATETIME'){
            return ((DateTime)fieldValue).format('yyyy-MM-dd') + 'T' + ((DateTime)fieldValue).format('HH:mm:ss') + 'Z';
            //return ((DateTime)fieldValue).format('yyyy-MM-ddTHH:mm:ssZ');
        } else if(fieldType == 'DOUBLE' || fieldType == 'INTEGER' || fieldType == 'CURRENCY' || fieldType == 'PERCENT'){
            return String.valueOf(fieldValue);
        } else if(fieldType == 'REFERENCE'){
            return String.valueOf(fieldValue);
        } else {
            return String.valueOf(fieldValue);
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static list<string> GetDownloadUrls(id contentDocumentId){
        list<string> urls = new list<string>();

        for(ContentVersion cv : [SELECT Id, VersionDataUrl FROM ContentVersion WHERE ContentDocumentId = :contentDocumentId]){
            urls.add(cv.VersionDataUrl);
        }

        return urls;

    }

    /**
     * @description Inner class to represent the result of a batch job submission
     */
    public class BatchJobResult {
        @AuraEnabled
        public Id jobId;

        @AuraEnabled
        public Id contentDocumentId;

        /**
         * @description Constructor for BatchJobResult
         * @param jobId The ID of the batch job
         * @param contentDocumentId The ID of the ContentVersion created for the job
         */
        public BatchJobResult(Id jobId, Id contentDocumentId) {
            this.jobId = jobId;
            this.contentDocumentId = contentDocumentId;
        }
    }
}
