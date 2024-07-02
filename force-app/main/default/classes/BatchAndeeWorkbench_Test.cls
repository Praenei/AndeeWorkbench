@isTest
private class BatchAndeeWorkbench_Test {
    
    @TestSetup
    static void setupTestData() {
        List<Account> accounts = new List<Account>();
        for(Integer i = 0; i < 200; i++) {
            accounts.add(new Account(Name = 'Test Account ' + i, Industry = 'Technology'));
        }
        insert accounts;
        
        List<Contact> contacts = new List<Contact>();
        for(Account acc : accounts) {
            contacts.add(new Contact(LastName = 'Contact for ' + acc.Name, AccountId = acc.Id));
        }
        insert contacts;
    }
    
    @isTest
    static void testSubmitQueryBatch() {
        List<String> fields = new List<String>{'Id', 'Name', 'Industry'};
        
        Test.startTest();
        BatchAndeeWorkbench.BatchJobResult result = BatchAndeeWorkbench.SubmitQueryBatch(
            'Account', 
            fields, 
            'Industry = \'Technology\'', 
            'Name ASC', 
            '200', 
            false
        );
        Test.stopTest();
        
        System.assertNotEquals(null, result.jobId, 'Job ID should not be null');
        System.assertNotEquals(null, result.contentVersionId, 'ContentVersion ID should not be null');
        
        // Verify the job status
        AsyncApexJob job = [SELECT Id, Status, NumberOfErrors FROM AsyncApexJob WHERE Id = :result.jobId];
        System.assertEquals('Completed', job.Status, 'Job should be completed');
        System.assertEquals(0, job.NumberOfErrors, 'There should be no errors');
        
        // Verify the content of the generated file
        ContentVersion cv = [SELECT Id, VersionData FROM ContentVersion WHERE Id = :result.contentVersionId];
        String fileContent = cv.VersionData.toString();
        List<String> lines = fileContent.split('\n');
        
        System.assertEquals(201, lines.size(), 'File should contain 201 lines (header + 200 records)');
        System.assert(lines[0].contains('Id\tName\tIndustry'), 'Header should contain the specified fields');
        for(Integer i = 1; i < lines.size(); i++) {
            System.assert(lines[i].contains('Test Account'), 'Each line should contain an account name');
            System.assert(lines[i].contains('Technology'), 'Each line should contain the Industry');
        }
    }
    
    @isTest
    static void testGetBatchJobStatus() {
        // First, submit a batch job
        List<String> fields = new List<String>{'Id', 'Name'};
        BatchAndeeWorkbench.BatchJobResult result = BatchAndeeWorkbench.SubmitQueryBatch(
            'Account', 
            fields, 
            '', 
            'Name ASC', 
            '200', 
            false
        );
        
        Test.startTest();
        AsyncApexJob jobStatus = BatchAndeeWorkbench.GetBatchJobStatus(result.jobId);
        Test.stopTest();
        
        System.assertNotEquals(null, jobStatus, 'Job status should not be null');
        System.assertEquals(result.jobId, jobStatus.Id, 'Job ID should match');
        System.assertEquals('Completed', jobStatus.Status, 'Job should be completed');
        System.assertEquals(0, jobStatus.NumberOfErrors, 'There should be no errors');
        System.assertEquals(200, jobStatus.TotalJobItems, 'Total job items should be 200');
        System.assertEquals(200, jobStatus.JobItemsProcessed, 'All job items should be processed');
    }
    
    @isTest
    static void testOldContentVersionDeletion() {
        // Create an old ContentVersion
        ContentVersion oldCv = new ContentVersion();
        oldCv.Title = 'QueryResults ' + System.currentTimeMillis();
        oldCv.VersionData = Blob.valueOf('Old test data');
        oldCv.PathOnClient = 'workBench/oldTest.tsv';
        oldCv.CreatedDate = Datetime.now().addDays(-31);
        Test.setCreatedDate(oldCv.Id, oldCv.CreatedDate);
        insert oldCv;
        
        List<String> fields = new List<String>{'Id', 'Name'};
        
        Test.startTest();
        BatchAndeeWorkbench.BatchJobResult result = BatchAndeeWorkbench.SubmitQueryBatch(
            'Account', 
            fields, 
            '', 
            'Name ASC', 
            '10', 
            false
        );
        Test.stopTest();
        
        // Verify that the old ContentVersion was deleted
        List<ContentVersion> oldVersions = [SELECT Id FROM ContentVersion WHERE Id = :oldCv.Id];
        System.assertEquals(0, oldVersions.size(), 'Old ContentVersion should be deleted');
        
        // Verify that the new ContentVersion exists
        List<ContentVersion> newVersions = [SELECT Id FROM ContentVersion WHERE Id = :result.contentVersionId];
        System.assertEquals(1, newVersions.size(), 'New ContentVersion should exist');
    }
}
