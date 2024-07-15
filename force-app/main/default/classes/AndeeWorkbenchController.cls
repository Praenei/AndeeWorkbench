/**
(c) Invesco 2024, all rights reserve
@date 01-Jul-2024      
@author Andee Weir
@description Implementation of Workbench
@modifications  
dd-Mmm-yyyy AuthorName             JIRA-ID : Description 
*/
public with sharing class AndeeWorkbenchController {

    private static map<string, string> fieldTypeMap = new map<string, string>();

    /* @method: GetSettings
     * @description:  Get the Org Domain URL & user's Timezone
     * @return : SettingsWrapper : OrgDomainUrl + UsersTimezone
    */   
    @AuraEnabled(cacheable=true)
    public static SettingsWrapper GetSettings(){
        SettingsWrapper settings = new SettingsWrapper();
        settings.OrgDomainUrl = System.url.getOrgDomainUrl().toExternalForm();
        settings.UsersTimezone = UserInfo.getTimeZone().getID();
        return settings;
    }
    
    /* @method: GetAllObjects
     * @description:  Get a sorted list of all objects in the org
     * @return : list<string> sorted list of API object names
    */
    @AuraEnabled(cacheable=true)
    public static list<string> GetAllObjects() {

        list<string> allObjects = new list<string>();
        List < Schema.SObjectType > gd = Schema.getGlobalDescribe().Values(); 
        Map<String , Schema.SObjectType > globalDescription = Schema.getGlobalDescribe();   

        for ( Schema.SObjectType f : gd ) { 
            allObjects.add(f.getDescribe().getName()); 
        }
        allObjects.sort();
        return allObjects;

    }


    /* @method: GetFieldsForObject
     * @description:  Get field details for the supplied object api name
     * @param : string objectName : API object name 
     * @return : list<FieldWrapper> : list of field key details for the object
    */ 
    @AuraEnabled
    public static list<FieldWrapper>  GetFieldsForObject(string objectName) {

        list<FieldWrapper> returnFields = new list<FieldWrapper>();
        map<string, FieldWrapper> fieldsMap = new map<string, FieldWrapper>();
        
        Map<String , Schema.SObjectType > globalDescription = Schema.getGlobalDescribe();
        Schema.sObjectType objType = globalDescription.get(objectName );
        Schema.DescribeSObjectResult r1 = objType.getDescribe();
        Map<String , Schema.SObjectField > mapFieldList = r1.fields.getMap();    

        list<string> fieldNames = new list<string>();
        for ( Schema.SObjectField field : mapFieldList.values() ) {    

            Schema.DescribeFieldResult fieldResult = field.getDescribe();
            if ( fieldResult.isAccessible() ) {  
                FieldWrapper fw = new FieldWrapper();
                fw.Name = fieldResult.getName();
                fw.Type = fieldResult.getType().name();
                fw.Filterable = fieldResult.isFilterable();
                fw.Groupable = fieldResult.isGroupable();
                fw.Updatable = fieldResult.isUpdateable();
                fw.Linkable = (fw.Type=='Id' || fw.Type=='REFERENCE')?true:false;
                fw.Value = '';
                fieldsMap.put(fw.Name, fw);
                fieldNames.add(fieldResult.getName()); 
            } 

        } 

        fieldNames.sort();

        // Add standard fields to top of returned list
        set<String> standardFields = new set<String>{'Id', 'Name', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById'};
        for(string standardField : standardFields){
            if(fieldNames.contains(standardField)){
                returnFields.add(fieldsMap.get(standardField));
            }
        }
        
        for(string fieldName : fieldNames){
            // Add non-standard fields to bottom of returned list
            if(!standardFields.contains(fieldName)){
                returnFields.add(fieldsMap.get(fieldName));
            }

        }


        return returnFields;
    }
    

    /* @method: SubmitQuery
     * @description:  Run a dynamic SOQL & return results
     * @param : String objectApiName : API object name 
     * @param : list<string> fields : list of field names which data should be retrieved for 
     * @param : string whereClause : the SOQL where clause 
     * @param : string sortOrder : the SOQL Order By clause 
     * @param : string limitCount : the SOQL Limit  
     * @param : boolean allRows : if to include deleted/archived rows or not 
     * @return : list<ResultWrapper> : the returned data.  Includes the rowid & then a list of name/value pairs
    */ 
    @AuraEnabled
    public static List<ResultWrapper> SubmitQuery(String objectApiName, list<string> fields, string whereClause, string sortOrder, string limitCount, boolean allRows) {

        List<ResultWrapper> results = new List<ResultWrapper>();

        boolean idAutoAdded = false;

        // handle if count() is in the fields
        if(fields.size() == 1 && fields[0].toLowerCase() == 'count()'){

            FieldData fw = new FieldData();
            fw.Name = 'count()';
            fw.Value = String.valueOf(SubmitQueryCount(objectApiName, whereClause, allRows));
            fw.Linkable = false;


            ResultWrapper rw = new ResultWrapper();
            rw.RowId = '0';
            rw.Fields = new List<FieldData>();
            rw.Fields.add(fw);

            results.add(rw);
            return results;
        }

        boolean idExists = false;
        // Add Id to the fields if it is not already there
        for(integer i=0; i<fields.size(); i++){
            if(fields[i].toLowerCase() == 'id'){
                idExists = true;
                break;
            }
        }

        if(!idExists){  
            fields.add('Id');
            idAutoAdded = true;
        }

        string query = constructQuery(objectApiName, fields, whereClause, sortOrder, limitCount, allRows);
        
        // Execute the query
        List<SObject> queryResults = Database.query(query);

        // Iterate through the results
        for (SObject obj : queryResults) {
            ResultWrapper wrapper = new ResultWrapper();
            wrapper.RowId = (String)obj.get('Id');
            wrapper.Fields = new List<FieldData>();

            for (String field : fields) {
                FieldData fieldData = new FieldData();
                fieldData.Name = field;
                string fieldType = null;

                if (field.contains('.')) {
                    // Handle related object fields
                    List<String> relationshipParts = field.split('\\.');
                    SObject relatedObj = obj;
                    Object fieldValue = null;

                    for (Integer i = 0; i < relationshipParts.size(); i++) {
                        if (relatedObj == null) break;

                        if (i == relationshipParts.size() - 1) {
                            fieldValue = relatedObj.get(relationshipParts[i]);
                            fieldType = GetFieldType(relationshipParts[i-1], relationshipParts[i]);
                        } else {
                            relatedObj = relatedObj.getSObject(relationshipParts[i]);
                        }
                    }

                    fieldData.Value = FormatFieldValue(fieldValue, fieldType);
                } else {
                    // Handle fields on the main object
                    fieldType = GetFieldType(objectApiName, field);
                    fieldData.Value = FormatFieldValue(obj.get(field), fieldType);
                    
                }
                if(field != 'Id' || (field == 'Id' &&  !idAutoAdded)){
                    wrapper.Fields.add(fieldData);
                }
            }

            results.add(wrapper);
        }

        return results;
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
            // convert datetimes from GMT to the user's timezone    
            //String convertedDate = ((DateTime)(fieldValue)).format('yyyy-MM-dd', UserInfo.getTimeZone().getID()) + 'T' + ((DateTime)(fieldValue)).format('HH:mm:ss', UserInfo.getTimeZone().getID()) + 'Z';
            
            // GMT only
            String convertedDate = ((DateTime)fieldValue).format('yyyy-MM-dd') + 'T' + ((DateTime)fieldValue).format('HH:mm:ss') + 'Z';
            return convertedDate;
            //return ((DateTime)fieldValue).format('yyyy-MM-ddTHH:mm:ssZ');
        } else if(fieldType == 'DOUBLE' || fieldType == 'INTEGER' || fieldType == 'CURRENCY' || fieldType == 'PERCENT'){
            return String.valueOf(fieldValue);
        } else if(fieldType == 'REFERENCE'){
            return String.valueOf(fieldValue);
        } else {
            return String.valueOf(fieldValue);
        }
    }
    

    /* @method: SubmitQueryTsv
     * @description: Submit a SOQL query that produces a TSV extract
     * @param : String objectApiName : API object name 
     * @param : list<string> fields : list of field names which data should be retrieved for 
     * @param : string whereClause : the SOQL where clause 
     * @param : string sortOrder : the SOQL Order By clause 
     * @param : string limitCount : the SOQL Limit  
     * @param : boolean allRows : if to include deleted/archived rows or not  
     * @return : id : the id of the ContentVersion record containing the output
    */
    @AuraEnabled
    public static Id SubmitQueryTsv(String objectApiName, list<string> fields, string whereClause, string sortOrder, string limitCount, boolean allRows) {


        // Build the query string
        string query = constructQuery(objectApiName, fields, whereClause, sortOrder, limitCount, allRows);

        
        // Execute the query
        List<SObject> queryResults = Database.query(query);

        String csvOutput = String.join(fields, '\t') + '\n';
        String fileRow = '';

        for (SObject obj : queryResults) {
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

        ContentVersion cv = new ContentVersion();
        cv.Title = 'QueryResults ' + System.currentTimeMillis();
        cv.VersionData = Blob.valueOf(csvOutput);
        cv.PathOnClient = cv.Title + '.tsv';

        insert cv;

        return cv.Id;

    }
    
    
    /* @method: SubmitQueryCount
     * @description: Submit a SOQL query that returns a count of the number of rows which would be returned
     * @param : String objectApiName : API object name 
     * @param : list<string> fields : list of field names which data should be retrieved for 
     * @param : string whereClause : the SOQL where clause 
     * @param : string sortOrder : the SOQL Order By clause 
     * @param : string limitCount : the SOQL Limit  
     * @param : boolean allRows : if to include deleted/archived rows or not  
     * @return : integer : the count of the number of rows 
    */
    @AuraEnabled
    public static Integer SubmitQueryCount(String objectApiName, string whereClause, boolean allRows) {

        list<string> fields = new list<string>();
        fields.add('count(Id)');

        string query = constructQuery(objectApiName, fields, whereClause, null, null, allRows);
        
        // Execute the query
        List<SObject> queryResults = Database.query(query);

        return (Integer)queryResults[0].get('expr0');

    }
    
    
    /* @method: constructQuery
     * @description: create a SOQL query based on the supplied params
     * @param : String objectApiName : API object name 
     * @param : list<string> fields : list of field names which data should be retrieved for 
     * @param : string whereClause : the SOQL where clause 
     * @param : string sortOrder : the SOQL Order By clause 
     * @param : string limitCount : the SOQL Limit  
     * @param : boolean allRows : if to include deleted/archived rows or not  
     * @return : string : SOQL statement
    */
    public static string constructQuery(String objectApiName, list<string> fields, string whereClause, string sortOrder, string limitCount, boolean allRows) {


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

        system.debug('query: ' + query);

        return query;
    }
    
    
    /* @method: GetSingleEntryData
     * @description: Return the data for all accessible fields in a single row
     * @param : id selectedId : the id of the row for which the data should be returned 
     * @return : QuerySingleRowWrapper : Object API name + field data returned in name/value pairs 
    */
    @AuraEnabled
    public static QuerySingleRowWrapper  GetSingleEntryData(id selectedId) {
        
        map<string, FieldWrapper> objFieldsMap = new map<string, FieldWrapper>();
        string objectApiName = selectedId.getsobjecttype().getDescribe().getName();

        list<FieldWrapper> objFields =  GetFieldsForObject(objectApiName);
        for(FieldWrapper objField : objFields){
            objFieldsMap.put(objField.Name, objField);
        }

        string query = 'SELECT ' + String.join(objFieldsMap.keyset(), ', ') + ' FROM ' + objectApiName + ' WHERE Id = \'' + selectedId + '\'';


        // Execute the query
        List<SObject> queryResults = Database.query(query);

        for(string fieldName : objFieldsMap.keyset()){
            objFieldsMap.get(fieldName).Value = FormatFieldValue(queryResults[0].get(fieldName), objFieldsMap.get(fieldName).Type);
            objFieldsMap.get(fieldName).OriginalValue = objFieldsMap.get(fieldName).Value;
        }

        QuerySingleRowWrapper wrapper = new QuerySingleRowWrapper();
        wrapper.ObjectApiName = objectApiName;
        wrapper.Fields = objFieldsMap.values();

        return wrapper;

    }
    
    
    /* @method: UpdateSingleEntryData
     * @description: Update the data in a single entry
     * @param : String querySingleRowJson : the json containing the data to update.  Could not pass object in!!!!
    */
    @AuraEnabled
    public static void  UpdateSingleEntryData(String querySingleRowJson) {

        // convert the JSON string to a QuerySingleRowWrapper object    
        QuerySingleRowWrapper querySingleRowWrapper = (QuerySingleRowWrapper)JSON.deserialize(querySingleRowJson, QuerySingleRowWrapper.class);

        system.debug(querySingleRowWrapper);

        // get the Id from querySingleRowWrapper    (always the first field in the list)
        id selectedId = Id.valueOf(querySingleRowWrapper.Fields[0].Value);
        
        string objectApiName = selectedId.getsobjecttype().getDescribe().getName();
        map<string, FieldWrapper> objFieldsMap = new map<string, FieldWrapper>();
        list<FieldWrapper> objFields = querySingleRowWrapper.Fields;
        for(FieldWrapper objField : objFields){
            objFieldsMap.put(objField.Name, objField);
        }

        // create an object of type objectApiName
        SObject obj = Schema.getGlobalDescribe().get(objectApiName).newSObject();

        boolean hasFieldValueChanged = false;

        // loop through the fields in querySingleRowWrapper.Fields and set the values on the object
        for(FieldWrapper field : objFields){
            if(field.Value != field.OriginalValue || field.Name == 'Id'){
                system.debug(field.Name + ' : ' + field.Type + ' : ' + field.Value + ' : ' + field.OriginalValue);
                if(field.Value != field.OriginalValue){
                    hasFieldValueChanged = true;
                }

                if(field.Type == 'BOOLEAN'){
                    obj.put(field.Name, field.Value == 'true');
                } else if(field.Type == 'DATE'){
                    obj.put(field.Name, Date.valueOf(field.Value));
                } else if(field.Type == 'DATETIME'){
                    string newDateTime = field.Value.replace('T', ' ').replace('Z', '');
                    obj.put(field.Name, DateTime.valueOf(newDateTime));
                } else if(field.Type == 'DECIMAL'){
                    obj.put(field.Name, Decimal.valueOf(field.Value));
                } else if(field.Type == 'INTEGER'){
                    obj.put(field.Name, Integer.valueOf(field.Value));
                } else if(field.Type == 'PERCENT'){
                    obj.put(field.Name, Decimal.valueOf(field.Value));
                } else {
                    obj.put(field.Name, String.valueOf(field.Value));
                }
            }
        }

        if(hasFieldValueChanged){
            update obj;
        }


    }
    
    
    /* @method: InsertSingleEntryData
     * @description: Insert a single entry
     * @param : String querySingleRowJson : the json containing the data to insert.  Could not pass object in!!!!
    */
    @AuraEnabled
    public static Id InsertSingleEntryData(String querySingleRowJson) {
        // convert the JSON string to a QuerySingleRowWrapper object    
        QuerySingleRowWrapper querySingleRowWrapper = (QuerySingleRowWrapper)JSON.deserialize(querySingleRowJson, QuerySingleRowWrapper.class);
        // create an object of type objectApiName
        SObject obj = Schema.getGlobalDescribe().get(querySingleRowWrapper.ObjectApiName).newSObject();

        list<FieldWrapper> objFields = querySingleRowWrapper.Fields;

        for(FieldWrapper field : objFields){
            if(field.Value != ''){
                if(field.Type == 'BOOLEAN'){
                    obj.put(field.Name, field.Value == 'true');
                } else if(field.Type == 'DATE'){
                    obj.put(field.Name, Date.valueOf(field.Value));
                } else if(field.Type == 'DATETIME'){
                    string newDateTime = field.Value.replace('T', ' ').replace('Z', '');
                    obj.put(field.Name, DateTime.valueOf(newDateTime));
                } else if(field.Type == 'DECIMAL'){
                    obj.put(field.Name, Decimal.valueOf(field.Value));
                } else if(field.Type == 'INTEGER'){
                    obj.put(field.Name, Integer.valueOf(field.Value));
                } else if(field.Type == 'PERCENT'){
                    obj.put(field.Name, Decimal.valueOf(field.Value));
                } else {
                    obj.put(field.Name, String.valueOf(field.Value));
                }
            }
            
        }

        insert obj;
        return obj.id;
    }
    
    
    /* @method: DeleteEntry
     * @description: Delete a single entry
     * @param : id selectedId : The id of the entry to be deleted
    */
    @AuraEnabled
    public static void DeleteEntry(id selectedId){
        string objectApiName = selectedId.getsobjecttype().getDescribe().getName();
        SObject obj = Schema.getGlobalDescribe().get(objectApiName).newSObject();
        obj.Id = selectedId;

        delete obj;

    }

 


    public class FieldWrapper{
        
        @AuraEnabled
        public String Name;
        
        @AuraEnabled
        public String Type;
        
        @AuraEnabled
        public Boolean Filterable;
        
        @AuraEnabled
        public Boolean Groupable;
        
        @AuraEnabled
        public Boolean Updatable;
        
        @AuraEnabled
        public Boolean Linkable;
        
        @AuraEnabled
        public String Value;
        
        @AuraEnabled
        public String OriginalValue;
    }
    
    public class ResultWrapper {
        @AuraEnabled public String RowId;
        @AuraEnabled public List<FieldData> Fields;
    }

    public class FieldData {
        @AuraEnabled public String Name;
        @AuraEnabled public String Value;
        @AuraEnabled public Boolean Linkable;
    }
    
    public class QuerySingleRowWrapper {
        @AuraEnabled public String ObjectApiName;
        @AuraEnabled public List<FieldWrapper> Fields;
    }

    public class SettingsWrapper {
        @AuraEnabled public String OrgDomainUrl;
        @AuraEnabled public String UsersTimezone;
    }


}
