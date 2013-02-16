"use strict";

require("../debug").logTraces();

var legendary = require("../");

legendary.fulfilled(42).trace("already fulfilled", { foo: "bar" });

legendary.rejected(new Error()).traceRejected();
