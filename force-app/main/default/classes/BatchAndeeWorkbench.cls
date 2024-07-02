/**
(c) Invesco 2024, all rights reserved
@date 01-Jul-2024      
@author Andee Weir
@description Implementation of Workbench for batch processing of large data sets
@modifications  
01-Jul-2024 Andee Weir             CDSME-xxxxx : Initial implementation
*/
public with sharing class BatchAndeeWorkbench implements Database.Batchable<sObject>, Database.Stateful {

    private String query;
    private list<string> fields;
    private id contentVersionId;
    private integer batchNumber = 0;

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
                    Object fieldValue = null;

                    for (Integer i = 0; i < relationshipParts.size(); i++) {
                        if (relatedObj == null) break;

                        if (i == relationshipParts.size() - 1) {
                            fieldValue = relatedObj.get(relationshipParts[i]);
                        } else {
                            relatedObj = relatedObj.getSObject(relationshipParts[i]);
                        }
                    }

                    if(fileRow != ''){
                        fileRow += '\t';
                    }
                    fileRow += (fieldValue==null)?'':String.valueOf(fieldValue);
                } else {
                    if(fileRow != ''){
                        fileRow += '\t';
                    }
                    // Handle fields on the main object
                    fileRow += (obj.get(field)==null)?'':string.valueOf(obj.get(field));
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
