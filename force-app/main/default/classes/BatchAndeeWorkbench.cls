/**
(c) Invesco 2024, all rights reserved
@date 01-Jul-2024      
@author Andee Weir
@description Implementation of Workbench for batch processing of large data sets
@modifications  
01-Jul-2024 Andee Weir             CDSME-xxxxx : Initial implementation
*/
public with sharing class BatchAndeeWorkbench implements Database.Batchable<sObject>, Database.Stateful {

    private string objectApiName;
    private String query;
    private list<string> fields;
    private id contentVersionId;
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

        ContentVersion cv = new ContentVersion();
        cv.Title = 'QueryResults ' + System.currentTimeMillis();
        cv.VersionData = Blob.valueOf(String.join(fields, '\t') + '\n');
        cv.PathOnClient = 'workBench/' + cv.Title + '.tsv';
        cv.isMajorVersion = false;

        insert cv;
        this.contentVersionId = cv.Id;

        // Delete any contentVersions which are older that 30 days & have a pathOnClient starting with 'workBench/'
        list<id> cdIds = new list<id>();
        for(contentVersion c : [SELECT id, contentdocumentId FROM ContentVersion WHERE Title LIKE 'QueryResults %' AND createdDate < :Datetime.now().addDays(-30) AND PathOnClient LIKE 'workBench/%']){
            cdIds.add(c.contentdocumentId);
        }
        delete [SELECT id FROM ContentDocument WHERE id IN :cdIds];
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
        String fileRow = '';
        string csvOutput = '';

        for (SObject obj : scope) {
            fileRow = '';

            for (String field : fields) {
                if (field.contains('.')) {
                    // Handle related object fields
                    List<String> relationshipParts = field.split('\\.');
                    SObject relatedObj = obj;
                    string fieldName = '';
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

                    if(fileRow != ''){
                        fileRow += '\t';
                    }
                    string fieldType = '';
                    try{
                        fieldType = GetFieldType(relatedObj.getSObjectType().getDescribe().getName(), fieldName);
                    } catch (Exception e){
                        fieldType = 'STRING';  // To handle things like Parent i.e. not an object
                    }
                    fileRow += (fieldValue==null)?'':FormatFieldValue(fieldValue, fieldType);
                } else {
                    if(fileRow != ''){
                        fileRow += '\t';
                    }
                    // Handle fields on the main object
                    fileRow += (obj.get(field)==null)?'':FormatFieldValue(obj.get(field), GetFieldType(objectApiName, field));
                }
            }
            csvOutput += fileRow + '\n';
        }

        ContentVersion cv = [SELECT id, VersionData FROM ContentVersion WHERE id = :contentVersionId];
        String existingData = cv.VersionData.toString();
        cv.VersionData = Blob.valueOf(existingData + csvOutput);
        update cv;
    }

    /**
     * @description Finish method for the batch process
     * @param bc The BatchableContext
     */
    public void finish(Database.BatchableContext bc) {
        // Do something when the batch finishes
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

        system.debug('Andee: ' + jobId + ' ' + job.contentVersionId);

        return new BatchJobResult(jobId, job.contentVersionId);
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

    /**
     * @description Inner class to represent the result of a batch job submission
     */
    public class BatchJobResult {
        @AuraEnabled
        public Id jobId;

        @AuraEnabled
        public Id contentVersionId;

        /**
         * @description Constructor for BatchJobResult
         * @param jobId The ID of the batch job
         * @param contentVersionId The ID of the ContentVersion created for the job
         */
        public BatchJobResult(Id jobId, Id contentVersionId) {
            this.jobId = jobId;
            this.contentVersionId = contentVersionId;
        }
    }
}
