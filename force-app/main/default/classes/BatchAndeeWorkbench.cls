public with sharing class BatchAndeeWorkbench implements Database.Batchable<sObject>, Database.Stateful {

    private String query;
    private list<string> fields;
    private id contentVersionId;
    private integer batchNumber = 0;

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

        // delete any contentVersions which are older that 30 days & have a pathOnClient starting with 'workBench/'
        list<id> cdIds = new list<id>();
        for(contentVersion c : [select id, contentdocumentId from ContentVersion where Title like 'QueryResults %' and createdDate < :Datetime.now().addDays(-30) and PathOnClient like 'workBench/%']){
            cdIds.add(c.contentdocumentId);
        }
        delete [select id from ContentDocument where id in :cdIds];


    }
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(query);
    }

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

        ContentVersion cv = [select id, VersionData from ContentVersion where id = :contentVersionId];
        String existingData = cv.VersionData.toString();
        cv.VersionData = Blob.valueOf(existingData + csvOutput);
        update cv;
    }

    public void finish(Database.BatchableContext bc) {
        // Do something when the batch finishes
    }

    @AuraEnabled
    public static BatchJobResult SubmitQueryBatch(String objectApiName, list<string> fields, string whereClause, string sortOrder, string limitCount, boolean allRows){
        BatchAndeeWorkbench job = new BatchAndeeWorkbench( objectApiName, fields,  whereClause,  sortOrder,  limitCount,  allRows);
        id jobId =  Database.executeBatch(job, 1);

        system.debug('Andee: ' + jobId + ' ' + job.contentVersionId);

        return new BatchJobResult(jobId, job.contentVersionId);
    }

    @AuraEnabled
    public static AsyncApexJob GetBatchJobStatus(Id jobId){
        return [SELECT Id, Status, NumberOfErrors, JobItemsProcessed, TotalJobItems FROM AsyncApexJob WHERE Id = :jobId];
    }

    


    private static string constructQuery(String objectApiName, list<string> fields, string whereClause, string sortOrder, string limitCount, boolean allRows) {


        // Build the query string
        String query = 'SELECT ' + String.join(fields, ', ') + ' FROM ' + objectApiName;
        if(whereClause != null && whereClause!=''){
            query += ' WHERE ' + whereClause;
        
        }
        if(sortOrder!=null && sortOrder!=''){
            query += ' ORDER BY ' + sortOrder;
        
        } 
        if(limitCount!=null && limitCount!=''){
            query += ' LIMIT ' + limitCount;
        }
        
        if(allRows != null && allRows){
            query += ' ALL ROWS ';
        }

        return query;
    }

    public class BatchJobResult {
        @AuraEnabled
        public Id jobId;

        @AuraEnabled
        public Id contentVersionId;

        public BatchJobResult(Id jobId, Id contentVersionId) {
            this.jobId = jobId;
            this.contentVersionId = contentVersionId;
        }
    }
}