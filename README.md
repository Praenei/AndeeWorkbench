<b>Summary</b>

A simplified version of Workbench built within Salesforce.  Handles simple queries & DML operations.  Includes 2 easter egg gamse for those that want a bit of down time.


<b>Features</b>

1) Simple queries including fields on referenced objects

![image](https://github.com/user-attachments/assets/6c129015-0f6f-42e0-83ce-d43bf9f29cec)

2) History of current session queries which you can select & re-run. Appears as arrows to the right of the query.
3) Abilty to export results to tab separated file (real-time & batch)
4) Drill through on any id to view full record details.  Mandatory fields in red, fields in bold are updatable i.e. not system/formula.

![image](https://github.com/user-attachments/assets/fbfbbb54-12fa-4a5d-ac25-dff6a27a5b73)

5) Ability to insert, update, delete & clone records.

![image](https://github.com/user-attachments/assets/31acfba0-c5f1-4f43-9326-3b84dd025424)


6) View records in Salesforce (preview icon next to id)
7) Order results with clickable headings
9) Ability to save favourite queries for later re-use.
10) Bonus easter egg games

<h5>Zombie:</h5>

![image](https://github.com/user-attachments/assets/f2c45f1e-c490-468c-9a04-332c0f753cf5)

<h5>Quotes:</h5>

![image](https://github.com/user-attachments/assets/c441e944-afd8-4af0-b7ca-9ec245d149ea)


<b>Installation</b> 

Order if not deploying all at once via Ant etc.
1) Objects/fields/layouts (AndeeWorkbench_Favourite__c)
2) Apex classes (AndeeWorkbenchController, AndeeWorkbenchController_Test, BatchAndeeWorkbench & BatchAndeeWorkbench_Test
3) All Static Resources
4) LWC - areYouSure
5) LWC - andeeZombie
6) LWC - disableBackButton
7) LWC - andeeQuotes
8) LWC - andeeWorkbench
9) Aura - AndeeWorkbenchWrapper

Easiest way is to download the metadata to your VSC folder & then just deploy from there.

Once completed I'd suggest Setup | Lightning App Builder | New.  Create an App Page, Label : Workbench, One Region, add the custom AndeeWorkbenchWrapper & Save.  Finally activate the page by adding the required profiles/lightning apps as required.


