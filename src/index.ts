import "module-alias/register";

import Client from "./client";
import * as structures from "./structures";

export = {
	Client,
	...structures,
};
