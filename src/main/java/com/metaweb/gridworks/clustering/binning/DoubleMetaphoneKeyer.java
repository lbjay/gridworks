package com.metaweb.gridworks.clustering.binning;

import org.apache.commons.codec.language.DoubleMetaphone;

public class DoubleMetaphoneKeyer extends Keyer {

    private DoubleMetaphone _metaphone2;

    public DoubleMetaphoneKeyer() {
        _metaphone2 = new DoubleMetaphone();
        _metaphone2.setMaxCodeLen(2000);
    }
    
    public String key(String s, Object... o) {
        return _metaphone2.doubleMetaphone(s);
    }

}
