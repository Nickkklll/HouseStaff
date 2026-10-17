import React from 'react';
import { FaTrash } from 'react-icons/fa';



export default function AddressBlock(props) {
    const{address, addressIndex, deleteAddress} = props;


  return (
    <div className=' cabinet-block'>
            <div className="address-body">
            <h3>Адресс №{addressIndex}</h3> 
            {Object.entries(address)
              .filter(([key]) => key !== 'id')
              .map(([key, value]) => (
                <p key={key} className={`address-block-${key}`}>{value},</p>
              ))}

            </div>
           <FaTrash className='address-block__delete-icon delete_button'  onClick={deleteAddress}/>
    </div>
  )
}
