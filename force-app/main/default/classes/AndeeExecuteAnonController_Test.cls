@isTest
public with sharing class AndeeExecuteAnonController_Test {

    private static testMethod void CodeCoverage() {

        Test.setMock(HttpCalloutMock.class, new MockHttpResponseGenerator());

        Test.startTest();
        AndeeExecuteAnonController.startDebugSession();

        String apexCode = 'System.debug(\'Hello World\');';
        String result = AndeeExecuteAnonController.executeAnonymousApex(apexCode);

        AndeeExecuteAnonController.getDebugLog('7tfUE000000858zYAA');

        AndeeExecuteAnonController.deleteDebugSession('00DUE000002eikL!AQEAQKOyMug3dlq_tj0orZrYgiJjg8jqvEPQfKJ4OXCESlIgOoNGy01BvSyTx5v5GaS_mK6TufUAnp5fg6DZloMP35qyeYwA', '7tfUE000000858zYAA');
        Test.stopTest();
    }

    private class MockAccessTokenResponseGenerator implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setBody('{"access_token": "testAccessToken", "instance_url": "https://test.salesforce.com"}');
            res.setStatusCode(200);
            return res;
        }
    }
}
