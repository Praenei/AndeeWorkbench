import { api } from 'lwc';
import LightningModal from 'lightning/modal';

export default class AreYouSure extends LightningModal {  

    @api message;

    handleApplyClose() {
        this.close(false);
    }

    handleContinue() {
        this.close(true);
    }

    handleCancel() {
        this.close(false);
    }

}