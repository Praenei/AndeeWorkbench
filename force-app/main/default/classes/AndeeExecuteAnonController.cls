public class AndeeExecuteAnonController {

    public static final string REDIRECT_URI = 'https://login.salesforce.com/services/oauth2/callback';
    

    
    @AuraEnabled
    public static String executeAnonymousApex(String apexCode) {

        string accessToken = getAccessToken();

        // Make a REST Api call using the access token to 


        HttpRequest req = new HttpRequest();
        req.setHeader('Content-Type', 'text/xml');
        req.setHeader('Authorization', 'Bearer ' + accessToken);

        system.debug(URL.getSalesforceBaseUrl().toExternalForm() + '/services/data/v63.0/tooling/executeAnonymous/?anonymousBody=' + EncodingUtil.urlEncode(apexCode, 'UTF-8'));
        req.setEndpoint(URL.getSalesforceBaseUrl().toExternalForm() + '/services/data/v63.0/tooling/executeAnonymous/?anonymousBody=' + EncodingUtil.urlEncode(apexCode, 'UTF-8'));
        req.setMethod('GET');

        Http http = new Http();
        HttpResponse res = http.send(req);

        system.debug('HTTP Response Status: ' + res.getStatus());
        system.debug('HTTP Response StatusCode: ' + res.getStatusCode());
        system.debug('HTTP Response Body: ' + res.getBody());

        return res.getBody();

    }

    public static string getAccessToken(){

        map<String, String> datakeyMap = GetEncryptedKeyDataPairs(new set<String>{'AndeeWorkbenchClientId', 'AndeeWorkbenchClientSecret', 'AndeeWorkbenchRefreshToken:'+UserInfo.getUserId()});


        HttpRequest req = new HttpRequest();
        Http http = new Http();

        String params =     'grant_type=refresh_token' +
                            '&client_id=' + datakeyMap.get('AndeeWorkbenchClientId') +
                            '&client_secret=' + datakeyMap.get('AndeeWorkbenchClientSecret') +
                            '&refresh_token=' + datakeyMap.get('AndeeWorkbenchRefreshToken:'+UserInfo.getUserId()) +
                            '&redirect_uri=' + REDIRECT_URI;
        req.setMethod('POST');

        req.setBody(params);

        system.debug('req.getBody(): ' + req.getBody());

        if(RunningInASandbox()){
            req.setEndpoint('https://test.salesforce.com/services/oauth2/token');
        } else {
            req.setEndpoint('https://login.salesforce.com/services/oauth2/token');
        }
        HTTPResponse resp;
        
        if(Test.isRunningTest()){ 
            resp = http.send(req);
            return 'testAccessToken';

        } else {
            resp = http.send(req);
        }  
        
        system.debug('accessToken response status code: ' + resp.getStatusCode());
        system.debug('accessToken response body: ' + resp.getBody());

        AuthResponse authResponse = null;
        if(resp.getStatusCode() == 200 || resp.getStatusCode() == 201){        
            authResponse = (AuthResponse)json.deserialize(resp.getBody(),AuthResponse.class);
            return authResponse.access_token;
        } else {
            return null;
        }

        
    }

    
    public static boolean RunningInASandbox(){
        return [SELECT Id, IsSandbox FROM Organization LIMIT 1].IsSandbox;
    }


    public static map<String, String> GetEncryptedKeyDataPairs(set<String> keys){
        map<String, String> keyDataMap = new map<string, string>();
        for(Data_Key__c dataKey : [select Key__c, Value__c from Data_Key__c where key__c = :keys]){
            keyDataMap.put(dataKey.Key__c, dataKey.Value__c);
        }
        return keyDataMap;
    }

    
    @AuraEnabled
    public static String getDebugLog(id debugId) {
        
        string accessToken = getAccessToken();

        list<ApexLog> apexLogs = [SELECT Id FROM ApexLog WHERE LogUserId = :UserInfo.getUserId() and Operation LIKE '%executeAnonymous/' ORDER BY StartTime DESC LIMIT 1];
        string apexLogId = '0';
        if(apexLogs.size() == 0){
            if(!Test.isRunningTest()){
                return 'No debug log found';
            } 
        } else {
            apexLogId = String.valueOf(apexLogs[0].id);
        }

        HttpRequest req = new HttpRequest();
        req.setHeader('Content-Type', 'text/xml');
        req.setHeader('Authorization', 'Bearer ' + accessToken);

        req.setEndpoint(URL.getSalesforceBaseUrl().toExternalForm() + '/services/data/v63.0/sobjects/ApexLog/' + apexLogId + '/Body');
        req.setMethod('GET');

        Http http = new Http();

        HTTPResponse resp;
        
        if(Test.isRunningTest()){ 
            resp = http.send(req);
            return '';

        } else {
            resp = http.send(req);
            if(debugId != null){
                deleteDebugSession(accessToken, debugId);
            }
        }

        return resp.getBody();

    }

    public static void deleteDebugSession(string accessToken, id debugId){
        HttpRequest req = new HttpRequest();
        req.setHeader('Content-Type', 'text/xml');
        req.setHeader('Authorization', 'Bearer ' + accessToken);

        req.setEndpoint(URL.getSalesforceBaseUrl().toExternalForm() + '/services/data/v35.0/tooling/sobjects/TraceFlag/' + debugId);
        req.setMethod('DELETE');

        Http http = new Http();

        HTTPResponse resp;
        
        if(!Test.isRunningTest()){ 
            resp = http.send(req);
        }

    }

    
    @AuraEnabled
    public static string startDebugSession() {

        string accessToken = getAccessToken();

        HttpRequest req = new HttpRequest();
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + accessToken);

        // Get the current Date/Time in yyyy-MM-ddTHH:mm:ssZ format
        Datetime dt = Datetime.now();

        // and the Date/Time in 1 hours time
        Datetime dtPlus1Hour = dt.addHours(1);

        startDebugBody sdb = new startDebugBody();
        sdb.ApexCode = 'DEBUG';
        sdb.ApexProfiling = 'NONE';
        sdb.Callout = 'NONE';
        sdb.Database = 'NONE';
        sdb.DebugLevelId = '7dl580000004KnfAAE';
        sdb.ExpirationDate = dtPlus1Hour.format('yyyy-MM-dd') + 'T' + dtPlus1Hour.format('HH:mm:ss') + 'Z';
        sdb.LogType = 'USER_DEBUG';
        sdb.StartDate = dt.format('yyyy-MM-dd') + 'T' + dt.format('HH:mm:ss') + 'Z';
        sdb.TracedEntityId=UserInfo.getUserId();
        sdb.Validation = 'NONE';
        sdb.Visualforce = 'NONE';
        sdb.Workflow = 'NONE';

        //req.setEndpoint(URL.getSalesforceBaseUrl().toExternalForm() + '/services/data/v63.0/tooling/sobjects/ApexDebugSession');
        req.setEndpoint(URL.getSalesforceBaseUrl().toExternalForm() + '/services/data/v35.0/tooling/sobjects/TraceFlag');
        req.setMethod('POST');
                       
        req.setBody(json.serialize(sdb));

        system.debug('req.getBody(): ' + req.getBody());

        Http http = new Http();
        HTTPResponse resp;
        
        if(Test.isRunningTest()){ 
            resp = http.send(req);
            return null;

        } else {
            resp = http.send(req);

            // if resp.getBody contains an 'id' property then a new debug session was started so return the id 
            // otherwise using an existing session so return null
            if(resp.getBody().contains('id')){
                return resp.getBody();
            } else {
                return null;
            } 

        }
        
    }
    
    
    public class AuthResponse{
        public string access_token;
        public string instance_url;
        public string message;
        public string errorcode;
    }

    public class StartDebugBody {
        public string ApexCode;
        public string ApexProfiling;
        public string Callout;
        public string Database;
        public string DebugLevelId;
        public string ExpirationDate;
        public string LogType;
        public string StartDate;
        public string TracedEntityId;
        public string Validation;
        public string Visualforce;
        public string Workflow;
    }
}
