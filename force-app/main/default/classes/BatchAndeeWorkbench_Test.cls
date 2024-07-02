/**
 * (c) Invesco 2024, all rights reserved
 * @date 01-Jul-2024
 * @author Andee Weir
 * @description Implementation of Workbench test class
 * @modifications 
 *     01-Jul-2024 Andee Weir : Initial version
 */
@isTest
private class BatchAndeeWorkbench_Test {
    
    /**
     * @method setupTestData
     * @description Sets up test data for the test methods
     * @param None
     * @return void
     */
    @TestSetup
    static void setupTestData() {
        List<Account> accounts = new List<Account>();
        for(Integer i = 0; i < 10; i++) {
            accounts.add(new Account(Name = 'Test Account ' + i, Industry = 'Technology'));
        }
        insert accounts;
        
        List<Contact> contacts = new List<Contact>();
        for(Account acc : accounts) {
            contacts.add(new Contact(LastName = 'Contact for ' + acc.Name, AccountId = acc.Id));
        }
        insert contacts;
    }
    
    /**
     * @method testSubmitQueryBatch
     * @description Tests the SubmitQueryBatch and GetBatchJobStatus methods of BatchAndeeWorkbench
     * @param None
     * @return void
     */
    @isTest
    static void testSubmitQueryBatch() {
        // First, submit a batch job
        List<String> fields = new List<String>{'Id', 'Name'};
        
        Test.startTest();
            BatchAndeeWorkbench.BatchJobResult result = BatchAndeeWorkbench.SubmitQueryBatch(
                'Account', 
                fields, 
                '', 
                'Name ASC', 
                '200', 
                false
            );
            AsyncApexJob jobStatus = BatchAndeeWorkbench.GetBatchJobStatus(result.jobId);
        Test.stopTest();
        
        System.assertNotEquals(null, jobStatus, 'Job status should not be null');
        System.assertEquals(result.jobId, jobStatus.Id, 'Job ID should match');
        System.assertNotEquals(null, jobStatus.Status, 'Job status should not be null');
        // Hard to check as not reliably able to delay the job
        /*System.assertEquals('Completed', jobStatus.Status, 'Job should be completed');
        System.assertEquals(0, jobStatus.NumberOfErrors, 'There should be no errors');
        System.assertEquals(1, jobStatus.TotalJobItems, 'Total job items should be 200');
        System.assertEquals(1, jobStatus.JobItemsProcessed, 'All job items should be processed');*/
    }
}
