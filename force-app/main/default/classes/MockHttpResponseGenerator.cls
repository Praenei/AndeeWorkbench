/**
(c) Invesco 2019, all rights reserve
@date 05-Jun-2019
@author Andee Weir 
@description Generate mock Http response for test classes (https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_restful_http_testing_httpcalloutmock.htm)
*/
@isTest
global class MockHttpResponseGenerator implements HttpCalloutMock {
    
    // Define return response values with defaults
    public Map<String, String> ResponseHeaderMap = new Map<String, String>{'Content-Type' => 'application/json'};
    public String ResponseBody = '{"example":"test"}';
    public Integer ResponseStatusCode = 200;
    
    public MockHttpResponseGenerator(Map<String, String> responseHeaderMap, String responseBody, Integer responseStatusCode){
        if (responseHeaderMap != null){
            this.ResponseHeaderMap = responseHeaderMap;
        }
        if (responseBody != null){
            this.ResponseBody = responseBody;
        }
        if (responseStatusCode != null){
        	this.ResponseStatusCode = responseStatusCode;
        }
    }
    
    public MockHttpResponseGenerator(){
        
    }
    
    // Implement this interface method
    global HTTPResponse respond(HTTPRequest req) {
                
        // Create a fake response
        HttpResponse res = new HttpResponse();
        for(string headerKey : this.ResponseHeaderMap.keySet()){
            res.setHeader(headerKey, this.ResponseHeaderMap.get(headerKey));
        }
        res.setHeader('Content-Type', 'application/json');
        res.setBody(this.ResponseBody);
        res.setStatusCode(this.ResponseStatusCode);
        return res;
    }
}