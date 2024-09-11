/**
(c) Invesco 2024, all rights reserved
@date 01-Jul-2024      
@author Andee Weir
@description Test class for AndeeWorkbenchController
@modifications  
dd-Mmm-yyyy AuthorName             JIRA-ID : Description 
*/
@isTest
private class AndeeWorkbenchController_Test {
    
    /**
     * @description Sets up test data for the test methods
     */
    @TestSetup
    static void setupTestData() {
        // Create parent account
        Account parentAccount = new Account(
            Name = 'Parent Account',
            Industry = 'Technology'
        );
        insert parentAccount;
        
        // Create child account
        Account childAccount = new Account(
            Name = 'Child Account',
            Industry = 'Finance',
            ParentId = parentAccount.Id
        );
        insert childAccount;
        
        // Create contacts
        List<Contact> contacts = new List<Contact>{
            new Contact(FirstName = 'John', LastName = 'Doe', AccountId = parentAccount.Id, Email = 'john.doe@example.com'),
            new Contact(FirstName = 'Jane', LastName = 'Smith', AccountId = childAccount.Id, Email = 'jane.smith@example.com')
        };
        insert contacts;
    }
    
    /**
     * @description Tests the GetSettings method
     */
    @isTest
    static void testGetSettings() {
        AndeeWorkbenchController.SettingsWrapper settings = AndeeWorkbenchController.GetSettings();
        System.assertNotEquals(null, settings.OrgDomainUrl, 'Org domain URL should not be null');
        System.assertNotEquals(null, settings.UsersTimezone, 'Users timezone should not be null');
    }
    
    /**
     * @description Tests the GetAllObjects method
     */
    @isTest
    static void testGetAllObjects() {
        List<AndeeWorkbenchController.ObjectWrapper> objects = AndeeWorkbenchController.GetAllObjects();

        set<String> objectLabels = new set<String>();
        set<String> objectApiNames = new set<String>();

        for (AndeeWorkbenchController.ObjectWrapper obj : objects) {
            objectLabels.add(obj.Label);
            objectApiNames.add(obj.ApiName);
        }

        System.assert(objectApiNames.contains('Account'), 'Account should be in the list of the api names of objects');
        System.assert(objectApiNames.contains('Contact'), 'Contact should be in the list of the api names of objects');

        System.assert(objectLabels.contains('Client/Third-Party'), 'Account should be in the list the labels of objects');
        System.assert(objectLabels.contains('Contact'), 'Contact should be in the list the labels of objects');
    }
    
    /**
     * @description Tests the GetFieldsForObject method
     */
    @isTest
    static void testGetFieldsForObject() {
        List<AndeeWorkbenchController.FieldWrapper> fields = AndeeWorkbenchController.GetFieldsForObject('Account');
        System.assert(fields.size() > 0, 'There should be fields returned for Account');
        
        Boolean hasNameField = false;
        for (AndeeWorkbenchController.FieldWrapper field : fields) {
            if (field.Name == 'Name') {
                hasNameField = true;
                break;
            }
        }
        System.assert(hasNameField, 'Account should have a Name field');
    }
    
    /**
     * @description Tests the SubmitQuery method
     */
    @isTest
    static void testSubmitQuery() {
        List<String> fields = new List<String>{'Id', 'Name', 'Industry', 'Parent.Name'};
        AndeeWorkbenchController.ResultWrapper result = AndeeWorkbenchController.SubmitQuery(
            'Account', 
            fields, 
            'Industry = \'Finance\'', 
            'Name ASC', 
            '10', 
            false,
            ''
        );
        
        System.assertEquals(1, result.TotalRowCountWithNoLimit, 'There should be one account with Finance industry');
        System.assertEquals(1, result.Rows.size(), 'There should be one account with Finance industry');
        System.assertEquals('Child Account', result.Rows[0].Fields[1].Value, 'The account name should be Child Account');
        System.assertEquals('Parent Account', result.Rows[0].Fields[3].Value, 'The parent account name should be Parent Account');
    }
    
    /**
     * @description Tests the SubmitQueryTsv method
     */
    @isTest
    static void testSubmitQueryTsv() {
        List<String> fields = new List<String>{'Id', 'FirstName', 'LastName', 'Email', 'Account.Name', 'Account.Parent.Name'};
        Id contentVersionId = AndeeWorkbenchController.SubmitQueryTsv(
            'Contact', 
            fields, 
            '', 
            'LastName ASC', 
            '10', 
            false
        );
        
        System.assertNotEquals(null, contentVersionId, 'ContentVersion ID should not be null');
        
        ContentVersion cv = [SELECT Id, VersionData FROM ContentVersion WHERE Id = :contentVersionId];
        String csvContent = cv.VersionData.toString();
        System.assert(csvContent.contains('John\tDoe'), 'CSV should contain John Doe');
        System.assert(csvContent.contains('Jane\tSmith'), 'CSV should contain Jane Smith');
    }
    
    /**
     * @description Tests the SubmitQueryCount method
     */
    @isTest
    static void testSubmitQueryCount() {
        Integer count = AndeeWorkbenchController.SubmitQueryCount('Account', 'Industry = \'Finance\'', false);
        System.assertEquals(1, count, 'There should be one account with Finance industry');
    }
    
    /**
     * @description Tests the GetSingleEntryData method
     */
    @isTest
    static void testGetSingleEntryData() {
        Account acc = [SELECT Id FROM Account WHERE Name = 'Child Account' LIMIT 1];
        AndeeWorkbenchController.QuerySingleRowWrapper result = AndeeWorkbenchController.GetSingleEntryData(acc.Id);
        
        System.assertEquals('Account', result.ObjectApiName, 'Object API Name should be Account');
        System.assert(result.Fields.size() > 0, 'There should be fields returned');
        
        Boolean hasNameField = false;
        for (AndeeWorkbenchController.FieldWrapper field : result.Fields) {
            if (field.Name == 'Name' && field.Value == 'Child Account') {
                hasNameField = true;
                break;
            }
        }
        System.assert(hasNameField, 'The result should contain the Name field with value Child Account');
    }
    
    /**
     * @description Tests the UpdateSingleEntryData method
     */
    @isTest
    static void testUpdateSingleEntryData() {
        Account acc = [SELECT Id, Name, Industry FROM Account WHERE Name = 'Child Account' LIMIT 1];
        
        AndeeWorkbenchController.QuerySingleRowWrapper wrapper = new AndeeWorkbenchController.QuerySingleRowWrapper();
        wrapper.ObjectApiName = 'Account';
        wrapper.Fields = new List<AndeeWorkbenchController.FieldWrapper>{
            new AndeeWorkbenchController.FieldWrapper(),
            new AndeeWorkbenchController.FieldWrapper()
        };
        wrapper.Fields[0].Name = 'Id';
        wrapper.Fields[0].Value = acc.Id;
        wrapper.Fields[0].Type = 'ID';
        wrapper.Fields[1].Name = 'Industry';
        wrapper.Fields[1].Value = 'Healthcare';
        wrapper.Fields[1].OriginalValue = acc.Industry;
        wrapper.Fields[1].Type = 'STRING';
        
        String wrapperJson = JSON.serialize(wrapper);
        
        Test.startTest();
        AndeeWorkbenchController.UpdateSingleEntryData(wrapperJson);
        Test.stopTest();
        
        Account updatedAcc = [SELECT Industry FROM Account WHERE Id = :acc.Id];
        System.assertEquals('Healthcare', updatedAcc.Industry, 'The account industry should be updated to Healthcare');
    }
    
    /**
     * @description Tests the InsertSingleEntryData method
     */
    @isTest
    static void testInsertSingleEntryData() {
        
        AndeeWorkbenchController.QuerySingleRowWrapper wrapper = new AndeeWorkbenchController.QuerySingleRowWrapper();
        wrapper.ObjectApiName = 'Account';
        wrapper.Fields = new List<AndeeWorkbenchController.FieldWrapper>{
            new AndeeWorkbenchController.FieldWrapper(),
            new AndeeWorkbenchController.FieldWrapper()
        };
        wrapper.Fields[0].Name = 'Name';
        wrapper.Fields[0].Value = 'New Account';
        wrapper.Fields[0].Type = 'STRING';
        wrapper.Fields[1].Name = 'Industry';
        wrapper.Fields[1].Value = 'Healthcare';
        wrapper.Fields[1].Type = 'STRING';
        
        String wrapperJson = JSON.serialize(wrapper);
        
        Test.startTest();
        Id newId = AndeeWorkbenchController.InsertSingleEntryData(wrapperJson);
        Test.stopTest();
        
        Account newAcc = [SELECT Id, Name, Industry FROM Account WHERE Id = :newId];
        System.assertEquals('New Account', newAcc.Name);
        System.assertEquals('Healthcare', newAcc.Industry);
    }    
    
    /**
     * @description Tests the DeleteEntry method
     */
    @isTest
    static void testDeleteEntry() {
        Account acc = [SELECT Id, Name, Industry FROM Account WHERE Name = 'Child Account' LIMIT 1];
        AndeeWorkbenchController.DeleteEntry(acc.Id);
        list<Account> resultAccs = [SELECT Id, Name, Industry FROM Account WHERE Name = 'Child Account'];
        system.assertEquals(0,resultAccs.size());
        AndeeWorkbenchController.UndeleteEntry(acc.Id);
        resultAccs = [SELECT Id, Name, Industry FROM Account WHERE Name = 'Child Account'];
        system.assertEquals(1,resultAccs.size());
    }   
    
    /**
     * @description Tests the testConvertTimeZoneFromUtc method
     */
    @isTest
    static void testConvertTimeZone() {

        // +1 as daylight saving (BST)
        system.assertEquals('2024-06-01T12:00:00Z', AndeeWorkbenchController.ConvertTimeZoneFromUtc('2024-06-01 11:00:00', 'Europe/London'));

        // same as GMT
        system.assertEquals('2024-12-01T11:00:00Z', AndeeWorkbenchController.ConvertTimeZoneFromUtc('2024-12-01 11:00:00', 'Europe/London'));

        // -4 as -5 timezone +1 for daylight saving
        system.assertEquals('2024-05-31T21:59:59Z', AndeeWorkbenchController.ConvertTimeZoneFromUtc('2024-06-01 01:59:59', 'America/New_York'));
        
        // -5 as -5 timezone
        system.assertEquals('2024-12-31T17:00:00Z', AndeeWorkbenchController.ConvertTimeZoneFromUtc('2024-12-31 22:00:00', 'America/New_York'));
    }
}