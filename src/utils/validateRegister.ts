import { UsernamePasswordInput } from "src/resolvers/UsernamePasswordInput";

export const validateRegister = ( options: UsernamePasswordInput ) => {
    if ( !options.email.includes("@") ) {
        return [{
            name: "email",
            "message": "Invalid email"
        }];
    }

    if ( options.username.length <=2 ) {
        return [{
            name: "username",
            "message": "User name should be at least 3 characters long"
        }];
    }

    if ( options.password.length <=2 ) {
        return [{
            name: "password",
            "message": "Password should be at least 3 characters long"
        }];
    }

    return null;
};
